import { z } from "zod/v4";
import { ConvexError, v } from "convex/values";
import { convexToZod, zodToConvex } from "convex-helpers/server/zod4";
import {
  httpAction,
  internalMutation,
  internalQuery,
  type QueryCtx,
  type MutationCtx,
  type ActionCtx,
} from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { internal } from "../_generated/api";
import { requireAccountUser } from "../identity/session";
import { requireWorkspaceForUser, type requireProject } from "../identity/access";
import { externalUserLite } from "../identity/external";
import { externalApiHeaders, verifyRequest } from "../identity/apiTokens";
import { apiIdSchema, apiRequestMetadata } from "../identity/schema";
import { createProject } from "./create";
import { beginProjectDeletion } from "./deletion";
import { writeProjectArchived } from "./settings";
import {
  projectApiCreate,
  projectApiPatch,
  projectApiLiteField,
  projectApiField,
  projectApiOrder,
  projectApiReference,
  projectApiReadOptions,
  projectApiSummaryField,
  projectApiSummaryFields,
  projectApiFailure,
  projectJson,
  projectJsonText,
  inactivityPolicyFields,
} from "./schema";
import { projectAppearance, requireApiProjectCover, setExternalCover } from "./cover_owner";
import { canReadApiProject } from "./network_access";
import { validateProjectMetadata, validateProjectLead } from "./metadata_fields";
import { validateTimezone } from "../settings/timezone";
import { ensureDefaultIntake } from "../intakes/configuration_owner";
import { writeInactivityPolicy } from "./inactivity";
import { selectEstimateSystem } from "../estimates/index";
import { descriptor } from "../assets/access";
import { publicationForProject } from "../publicSharing/access";

async function workspaceAccess(ctx: QueryCtx, slug: string, userId: Id<"users">, write = false) {
  let user;
  try {
    user = await requireAccountUser(ctx, userId);
  } catch (error) {
    if (error instanceof ConvexError) throw new ConvexError({ status: 403, detail: "Your account is unavailable." });
    throw error;
  }
  const workspace = await ctx.db
    .query("workspaces")
    .withIndex("by_slug", (q) => q.eq("slug", slug))
    .unique();
  if (!workspace || workspace.deletedAt != null)
    throw new ConvexError({ status: 403, detail: "You do not have access to this workspace." });
  try {
    return await requireWorkspaceForUser(ctx, workspace._id, user, write);
  } catch (error) {
    if (error instanceof ConvexError)
      throw new ConvexError({ status: 403, detail: "You do not have access to this workspace." });
    throw error;
  }
}
async function apiProjectMembership(
  ctx: QueryCtx,
  project: Doc<"projects">,
  access: Awaited<ReturnType<typeof workspaceAccess>>
) {
  const member = await ctx.db
    .query("projectMembers")
    .withIndex("by_project_user", (q) => q.eq("projectId", project._id).eq("userId", access.user._id))
    .unique();
  return member?.active && member.workspaceId === access.workspace._id ? member : null;
}
async function visibleProject(
  ctx: QueryCtx,
  project: Doc<"projects">,
  access: Awaited<ReturnType<typeof workspaceAccess>>
) {
  if (project.workspaceId !== access.workspace._id || project.deletedAt != null) return null;
  const membership = await apiProjectMembership(ctx, project, access);
  return canReadApiProject(project, membership) ? { project, membership } : null;
}
function known<T>(field: string, value: T | undefined): T {
  if (value === undefined)
    throw new ConvexError({
      status: 503,
      detail: `This project's ${field} public contract is unavailable. Its stored history has not been adopted.`,
    });
  return value;
}
function unsupportedReference(field: string): never {
  throw new ConvexError({ status: 503, detail: `The ${field} public reference is not supported by this API yet.` });
}
async function userReference(
  ctx: QueryCtx,
  userId: Id<"users"> | null | undefined,
  field: string,
  expand: string[],
  access: Awaited<ReturnType<typeof workspaceAccess>>,
  assetOrigin: string
) {
  const id = known(field, userId);
  if (id === null) return expand.includes(field) ? {} : null;
  const account = await ctx.db.get(id);
  if (!account) return unsupportedReference(field);
  return expand.includes(field)
    ? externalUserLite(ctx, account, assetOrigin, access.workspace)
    : apiIdSchema.parse(account.apiId);
}
async function projectCount(ctx: QueryCtx, project: Doc<"projects">, field: z.infer<typeof projectApiSummaryField>) {
  switch (field) {
    case "members":
      return (
        await ctx.db
          .query("projectMembers")
          .withIndex("by_project_user", (q) => q.eq("projectId", project._id))
          .collect()
      ).filter((row) => row.active && row.workspaceId === project.workspaceId).length;
    case "states":
      return (
        await ctx.db
          .query("taskStates")
          .withIndex("by_project_order", (q) => q.eq("projectId", project._id))
          .collect()
      ).filter((row) => row.status !== "triage" && row.workspaceId === project.workspaceId).length;
    case "labels":
      return (
        await ctx.db
          .query("taskLabels")
          .withIndex("by_project_order", (q) => q.eq("projectId", project._id))
          .collect()
      ).filter((row) => !row.retiring && row.workspaceId === project.workspaceId).length;
    case "cycles":
      return (
        await ctx.db
          .query("cycles")
          .withIndex("by_project", (q) => q.eq("projectId", project._id).eq("deleted", false))
          .collect()
      ).length;
    case "modules":
      return (
        await ctx.db
          .query("modules")
          .withIndex("by_project", (q) => q.eq("projectId", project._id).eq("deleted", false))
          .collect()
      ).length;
    case "issues":
      return (
        await ctx.db
          .query("tasks")
          .withIndex("by_project", (q) => q.eq("projectId", project._id))
          .collect()
      ).filter((row) => row.deletedAt === null && row.status !== "triage" && row.workspaceId === project.workspaceId)
        .length;
    case "intakes":
      return (
        await ctx.db
          .query("intakeTasks")
          .withIndex("by_project", (q) => q.eq("projectId", project._id))
          .collect()
      ).filter((row) => row.deletedAt === null).length;
    case "pages":
      return (
        await ctx.db
          .query("documents")
          .withIndex("by_workspace", (q) => q.eq("workspaceId", project.workspaceId).eq("deleted", false))
          .collect()
      ).filter((row) => row.projectIds.includes(project._id)).length;
  }
}
async function projectWire(
  ctx: QueryCtx,
  row: NonNullable<Awaited<ReturnType<typeof visibleProject>>>,
  access: Awaited<ReturnType<typeof workspaceAccess>>,
  fields: string[] | null,
  expand: string[],
  assetOrigin: string,
  listing: boolean
) {
  const { project, membership } = row;
  const appearance = await projectAppearance(ctx, project._id);
  const needsCover = fields === null || fields.includes("cover_image_asset") || fields.includes("cover_image_url");
  const coverAsset =
    appearance?.coverAssetId && needsCover
      ? await requireApiProjectCover(ctx, access.user._id, appearance.coverAssetId)
      : null;
  const policy = await ctx.db
    .query("projectInactivityPolicies")
    .withIndex("by_project", (q) => q.eq("projectId", project._id))
    .unique();
  const values = {
    id: () => apiIdSchema.parse(project.apiId),
    created_at: () => new Date(project._creationTime).toISOString(),
    updated_at: () => new Date(known("updated_at", project.updatedAt)).toISOString(),
    deleted_at: () => null,
    name: () => project.name,
    description: () => project.description,
    description_text: () => {
      const text = known("description_text", project.descriptionTextJson);
      return text === null ? null : projectJsonText.parse(text);
    },
    description_html: () => {
      const text = known("description_html", project.descriptionHtmlJson);
      return text === null ? null : projectJsonText.parse(text);
    },
    network: () => known("network", project.network),
    identifier: () => project.identifier,
    emoji: () => known("emoji", project.emoji),
    icon_prop: () => {
      const text = known("icon_prop", project.iconPropsJson);
      return text === null ? null : projectJsonText.parse(text);
    },
    module_view: () => known("features", project.features).modules,
    cycle_view: () => known("features", project.features).cycles,
    issue_views_view: () => known("features", project.features).views,
    page_view: () => known("features", project.features).pages,
    intake_view: () => known("intake_view", project.intakeEnabled),
    is_time_tracking_enabled: () => known("is_time_tracking_enabled", project.timeTrackingEnabled),
    is_issue_type_enabled: () => known("is_issue_type_enabled", project.issueTypeEnabled),
    guest_view_all_features: () => known("guest_view_all_features", project.guestViewAllFeatures),
    cover_image: () => appearance?.externalCoverUrl ?? null,
    cover_image_asset: () => (coverAsset ? apiIdSchema.parse(coverAsset.apiId) : null),
    cover_image_url: () =>
      coverAsset
        ? new URL(descriptor(coverAsset).downloadPath, assetOrigin).toString()
        : appearance?.externalCoverUrl || null,
    estimate: async () => {
      const config = await ctx.db
        .query("projectEstimates")
        .withIndex("by_project", (q) => q.eq("projectId", project._id))
        .unique();
      if (!config?.activeSystemId) return null;
      const system = await ctx.db.get(config.activeSystemId);
      if (system?.projectId !== project._id || system.workspaceId !== project.workspaceId)
        return unsupportedReference("estimate");
      return apiIdSchema.parse(system.apiId);
    },
    archive_in: () => policy?.archiveMonths ?? 0,
    close_in: () => policy?.close?.months ?? 0,
    logo_props: () => projectJson.parse(known("logo_props", project.logoProps)),
    archived_at: () => {
      const timestamp = known("archived_at", project.archivedAt);
      return timestamp === null ? null : new Date(timestamp).toISOString();
    },
    timezone: () => known("timezone", project.timezone),
    external_source: () => known("external_source", project.externalSource),
    external_id: () => known("external_id", project.externalId),
    created_by: () => userReference(ctx, project.createdById, "created_by", expand, access, assetOrigin),
    updated_by: () => userReference(ctx, project.updatedById, "updated_by", expand, access, assetOrigin),
    workspace: () =>
      expand.includes("workspace")
        ? { id: apiIdSchema.parse(access.workspace.apiId), name: access.workspace.name, slug: access.workspace.slug }
        : apiIdSchema.parse(access.workspace.apiId),
    default_assignee: () =>
      userReference(ctx, project.defaultAssigneeId, "default_assignee", expand, access, assetOrigin),
    project_lead: () => userReference(ctx, project.leadId, "project_lead", expand, access, assetOrigin),
    default_state: async () => {
      const id = known("default_state", project.defaultStateId);
      if (id === null) return null;
      const state = await ctx.db.get(id);
      if (state?.projectId !== project._id || state.workspaceId !== project.workspaceId)
        return unsupportedReference("default_state");
      return apiIdSchema.parse(state.apiId);
    },
    total_members: () => projectCount(ctx, project, "members"),
    total_cycles: () => projectCount(ctx, project, "cycles"),
    total_modules: () => projectCount(ctx, project, "modules"),
    is_member: () => membership !== null,
    member_role: () => (membership ? { admin: 20, member: 15, guest: 5 }[membership.role] : null),
    is_deployed: async () => {
      const publication = await publicationForProject(ctx, project._id);
      return publication !== null && publication.revokedAt === null;
    },
    sort_order: () => (membership ? known("sort_order", membership.apiSortOrder) : null),
  } satisfies Record<
    z.infer<typeof projectApiField>,
    () => z.infer<typeof projectJson> | Promise<z.infer<typeof projectJson>>
  >;
  const selected = Object.entries(values).filter(
    ([field]) => (listing || field !== "sort_order") && (fields === null || fields.includes(field))
  );
  return Object.fromEntries(
    await Promise.all(
      selected.map(async ([field, read]) => [
        field,
        expand.includes(field) && !projectApiReference.safeParse(field).success ? null : await read(),
      ])
    )
  );
}
const readArgs = {
  userId: v.id("users"),
  slug: v.string(),
  fields: v.union(v.array(v.string()), v.null()),
  expand: v.array(v.string()),
  assetOrigin: v.string(),
};
export const read = internalQuery({
  args: { ...readArgs, projectApiId: v.string() },
  handler: async (ctx, args) => {
    const access = await workspaceAccess(ctx, args.slug, args.userId);
    const project = await ctx.db
      .query("projects")
      .withIndex("by_api_id", (q) => q.eq("apiId", apiIdSchema.parse(args.projectApiId)))
      .unique();
    const row = project && (await visibleProject(ctx, project, access));
    if (!row) throw new ConvexError({ status: 404, detail: "Project not found." });
    return JSON.stringify(await projectWire(ctx, row, access, args.fields, args.expand, args.assetOrigin, false));
  },
});
export const summary = internalQuery({
  args: {
    userId: v.id("users"),
    slug: v.string(),
    projectApiId: v.string(),
    fields: v.array(zodToConvex(projectApiSummaryField)),
  },
  handler: async (ctx, args) => {
    const access = await workspaceAccess(ctx, args.slug, args.userId, true);
    const project = await ctx.db
      .query("projects")
      .withIndex("by_api_id", (q) => q.eq("apiId", apiIdSchema.parse(args.projectApiId)))
      .unique();
    if (!project || project.workspaceId !== access.workspace._id || project.deletedAt != null)
      throw new ConvexError({ status: 404, error: "Project not found" });
    const counts: Partial<Record<z.infer<typeof projectApiSummaryField>, number>> = {};
    await Promise.all(
      args.fields.map(async (field) => {
        counts[field] = await projectCount(ctx, project, field);
      })
    );
    return {
      id: apiIdSchema.parse(project.apiId),
      name: project.name,
      identifier: project.identifier,
      counts,
    };
  },
});
export const list = internalQuery({
  args: {
    ...readArgs,
    perPage: v.number(),
    page: v.number(),
    orderBy: v.string(),
    lite: v.boolean(),
    includeArchived: v.boolean(),
  },
  handler: async (ctx, args) => {
    const perPage = z.int().min(1).max(1000).parse(args.perPage);
    const page = z.int().nonnegative().parse(args.page);
    const access = await workspaceAccess(ctx, args.slug, args.userId);
    const projects = await ctx.db
      .query("projects")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", access.workspace._id))
      .collect();
    const cohort = (
      await Promise.all(
        projects
          .filter((project) => !args.lite || args.includeArchived || !project.archived)
          .map((project) => visibleProject(ctx, project, access))
      )
    ).filter((row) => row !== null);
    const reverse = args.orderBy.startsWith("-");
    const parsedOrder = projectApiOrder.safeParse(reverse ? args.orderBy.slice(1) : args.orderBy);
    const order = parsedOrder.success ? parsedOrder.data : args.lite ? "created_at" : "sort_order";
    const descending = parsedOrder.success ? reverse : args.lite;
    const ordered = cohort.map((row) => ({
      row,
      value:
        order === "created_at"
          ? row.project._creationTime
          : order === "updated_at"
            ? known(order, row.project.updatedAt)
            : order === "sort_order"
              ? row.membership
                ? known(order, row.membership.apiSortOrder)
                : null
              : known(order, row.project[order]),
    }));
    ordered.sort((a, b) => {
      if (a.value === null || b.value === null)
        return a.value === b.value ? 0 : a.value === null ? (descending ? -1 : 1) : descending ? 1 : -1;
      const comparison =
        typeof a.value === "string" && typeof b.value === "string"
          ? a.value.localeCompare(b.value)
          : a.value < b.value
            ? -1
            : a.value > b.value
              ? 1
              : 0;
      return descending ? -comparison : comparison;
    });
    const offset = page * perPage;
    const results = await Promise.all(
      ordered
        .slice(offset, offset + perPage)
        .map(({ row }) =>
          projectWire(
            ctx,
            row,
            access,
            args.lite ? projectApiLiteField.options : args.fields,
            args.lite ? [] : args.expand,
            args.assetOrigin,
            !args.lite
          )
        )
    );
    return JSON.stringify({
      grouped_by: null,
      sub_grouped_by: null,
      total_count: cohort.length,
      next_cursor: `${perPage}:${page + 1}:0`,
      prev_cursor: `${perPage}:${page - 1}:1`,
      next_page_results: offset + perPage < cohort.length,
      prev_page_results: page > 0,
      count: results.length,
      total_pages: Math.ceil(cohort.length / perPage),
      total_results: cohort.length,
      extra_stats: null,
      results,
    });
  },
});
const defaultIcons = [
  "home",
  "apps",
  "settings",
  "star",
  "favorite",
  "done",
  "check_circle",
  "add_task",
  "create_new_folder",
  "dataset",
  "terminal",
  "key",
  "rocket",
  "public",
  "quiz",
  "mood",
  "gavel",
  "eco",
  "diamond",
  "forest",
  "bolt",
  "sync",
  "cached",
  "library_add",
  "view_timeline",
  "view_kanban",
  "empty_dashboard",
  "cycle",
];
const defaultColors = ["#95999f", "#6d7b8a", "#5e6ad2", "#02b5ed", "#02b55c", "#f2be02", "#e57a00", "#f38e82"];
export const create = internalMutation({
  args: { userId: v.id("users"), slug: v.string(), bodyJson: v.string(), assetOrigin: v.string() },
  handler: async (ctx, args) => {
    const input = projectApiCreate.parse(projectJsonText.parse(args.bodyJson));
    const access = await workspaceAccess(ctx, args.slug, args.userId, true);
    const leadId = await apiUserId(ctx, input.project_lead);
    const assigneeId = await apiUserId(ctx, input.default_assignee);
    const months = convexToZod(inactivityPolicyFields.archiveMonths);
    const randomness = crypto.randomUUID().replaceAll("-", "");
    const projectId = await createProject(
      ctx,
      {
        workspaceId: access.workspace._id,
        name: input.name,
        identifier: input.identifier,
        description: input.description,
        leadId,
        defaultAssigneeId: assigneeId,
        timezone: input.timezone,
        features: {
          modules: input.module_view,
          cycles: input.cycle_view,
          views: input.issue_views_view,
          pages: input.page_view,
        },
        intakeEnabled: input.intake_view,
        guestViewAllFeatures: input.guest_view_all_features,
        externalCoverUrl: input.cover_image,
        archiveMonths: months.parse(input.archive_in),
        closeMonths: months.parse(input.close_in),
        iconPropsJson: input.icon_prop === null ? null : JSON.stringify(input.icon_prop),
        emoji: input.emoji,
        externalSource: input.external_source,
        externalId: input.external_id,
        issueTypeEnabled: input.is_issue_type_enabled,
        timeTrackingEnabled: input.is_time_tracking_enabled,
        logoProps: {
          in_use: "icon",
          icon: {
            name: defaultIcons[parseInt(randomness.slice(0, 8), 16) % defaultIcons.length],
            color: defaultColors[parseInt(randomness.slice(8, 16), 16) % defaultColors.length],
          },
        },
      },
      access
    ).catch((error: unknown) => {
      if (error instanceof ConvexError && typeof error.data === "string")
        throw new ConvexError({ status: 400, detail: error.data });
      throw error;
    });
    const project = await ctx.db.get(projectId);
    if (!project) throw new ConvexError("Created project is unavailable.");
    const row = await visibleProject(ctx, project, access);
    if (!row) throw new ConvexError("Created project membership is unavailable.");
    return JSON.stringify(await projectWire(ctx, row, access, null, [], args.assetOrigin, false));
  },
});
async function apiUserId(ctx: QueryCtx, apiId: string | null) {
  if (apiId === null) return null;
  const account = await ctx.db
    .query("users")
    .withIndex("by_api_id", (q) => q.eq("apiId", apiId))
    .unique();
  if (!account) throw new ConvexError({ status: 400, detail: "Referenced user not found." });
  return account._id;
}
async function patchReferences(
  ctx: MutationCtx,
  permission: Awaited<ReturnType<typeof requireProject>>,
  input: z.infer<typeof projectApiPatch>
) {
  const { project } = permission;
  const fields = {
    leadId: project.leadId,
    defaultAssigneeId: project.defaultAssigneeId,
    defaultStateId: project.defaultStateId,
  };
  if (input.project_lead !== undefined) {
    fields.leadId = await apiUserId(ctx, input.project_lead);
    await validateProjectLead(ctx, project.workspaceId, fields.leadId);
  }
  if (input.default_assignee !== undefined) {
    const id = await apiUserId(ctx, input.default_assignee);
    if (id !== null) {
      const membership = await ctx.db
        .query("workspaceMembers")
        .withIndex("by_workspace_user", (q) => q.eq("workspaceId", project.workspaceId).eq("userId", id))
        .unique();
      if (!membership) throw new ConvexError("Default assignee must belong to this workspace.");
    }
    fields.defaultAssigneeId = id;
  }
  if (input.default_state !== undefined) {
    const apiId = input.default_state;
    if (apiId === null) fields.defaultStateId = null;
    else {
      const state = await ctx.db
        .query("taskStates")
        .withIndex("by_api_id", (q) => q.eq("apiId", apiId))
        .unique();
      if (!state || state.projectId !== project._id || state.workspaceId !== project.workspaceId)
        throw new ConvexError("Default state must belong to this project.");
      fields.defaultStateId = state._id;
    }
  }
  if (input.estimate !== undefined) {
    const apiId = input.estimate;
    if (apiId === null) await selectEstimateSystem(ctx, permission, null);
    else {
      const system = await ctx.db
        .query("estimateSystems")
        .withIndex("by_api_id", (q) => q.eq("apiId", apiId))
        .unique();
      if (!system) throw new ConvexError("Estimate system not found.");
      await selectEstimateSystem(ctx, permission, system._id);
    }
  }
  return fields;
}
async function patchMetadata(
  ctx: MutationCtx,
  permission: Awaited<ReturnType<typeof requireProject>>,
  input: z.infer<typeof projectApiPatch>
) {
  const { project, user } = permission;
  const references = await patchReferences(ctx, permission, input);
  const metadata = await validateProjectMetadata(ctx, project.workspaceId, { ...project, ...input }, project._id);
  const features = known("features", project.features);
  await ctx.db.patch(project._id, {
    ...metadata,
    ...references,
    features: {
      modules: input.module_view ?? features.modules,
      cycles: input.cycle_view ?? features.cycles,
      views: input.issue_views_view ?? features.views,
      pages: input.page_view ?? features.pages,
    },
    intakeEnabled: input.intake_view ?? project.intakeEnabled,
    guestViewAllFeatures: input.guest_view_all_features ?? project.guestViewAllFeatures,
    iconPropsJson:
      input.icon_prop === undefined
        ? project.iconPropsJson
        : input.icon_prop === null
          ? null
          : JSON.stringify(input.icon_prop),
    emoji: input.emoji === undefined ? project.emoji : input.emoji,
    externalSource: input.external_source === undefined ? project.externalSource : input.external_source,
    externalId: input.external_id === undefined ? project.externalId : input.external_id,
    issueTypeEnabled: input.is_issue_type_enabled ?? project.issueTypeEnabled,
    timeTrackingEnabled: input.is_time_tracking_enabled ?? project.timeTrackingEnabled,
    timezone: input.timezone === undefined ? project.timezone : validateTimezone(input.timezone),
    metadataRevision: project.metadataRevision + 1,
    updatedAt: Date.now(),
    updatedById: user._id,
  });
}
async function patchInactivity(
  ctx: MutationCtx,
  permission: Awaited<ReturnType<typeof requireProject>>,
  input: z.infer<typeof projectApiPatch>
) {
  const { project, user } = permission;
  if (input.archive_in !== undefined || input.close_in !== undefined) {
    const policy = await ctx.db
      .query("projectInactivityPolicies")
      .withIndex("by_project", (q) => q.eq("projectId", project._id))
      .unique();
    const months = convexToZod(inactivityPolicyFields.archiveMonths);
    const closeMonths = months.parse(input.close_in ?? policy?.close?.months ?? 0);
    const cancelled = closeMonths
      ? policy?.close
        ? await ctx.db.get(policy.close.stateId)
        : await ctx.db
            .query("taskStates")
            .withIndex("by_project_order", (q) => q.eq("projectId", project._id))
            .filter((q) => q.eq(q.field("status"), "cancelled"))
            .first()
      : null;
    if (closeMonths && !cancelled) throw new ConvexError("Choose a cancellation state in this project.");
    await writeInactivityPolicy(
      ctx,
      { projectId: project._id, workspaceId: project.workspaceId, configuredBy: user._id },
      {
        archiveMonths: months.parse(input.archive_in ?? policy?.archiveMonths ?? 0),
        close: closeMonths && cancelled ? { months: closeMonths, stateId: cancelled._id } : null,
      },
      policy
    );
  }
}
export const patch = internalMutation({
  args: {
    userId: v.id("users"),
    slug: v.string(),
    projectApiId: v.string(),
    bodyJson: v.string(),
    assetOrigin: v.string(),
  },
  handler: async (ctx, args) => {
    const input = projectApiPatch.parse(projectJsonText.parse(args.bodyJson));
    const access = await workspaceAccess(ctx, args.slug, args.userId);
    const project = await ctx.db
      .query("projects")
      .withIndex("by_api_id", (q) => q.eq("apiId", apiIdSchema.parse(args.projectApiId)))
      .unique();
    if (!project || project.workspaceId !== access.workspace._id || project.deletedAt != null)
      throw new ConvexError({ status: 404, detail: "Project not found." });
    const membership = await apiProjectMembership(ctx, project, access);
    if (!membership || (membership.role !== "admin" && access.member.role !== "admin"))
      throw new ConvexError({
        status: 403,
        detail: "Only joined workspace or project administrators can update this project.",
      });
    if (project.archived) throw new ConvexError({ status: 400, detail: "Archived project cannot be updated." });
    const permission = { ...access, project, projectMember: membership };
    try {
      await patchMetadata(ctx, permission, input);
      const current = await ctx.db.get(project._id);
      if (!current) throw new Error("Updated project is unavailable.");
      if (current.intakeEnabled) await ensureDefaultIntake(ctx, current);
      if (input.cover_image !== undefined)
        await setExternalCover(ctx, project._id, await projectAppearance(ctx, project._id), input.cover_image);
      await patchInactivity(ctx, permission, input);
    } catch (error) {
      if (error instanceof ConvexError && typeof error.data === "string")
        throw new ConvexError({ status: 400, detail: error.data });
      throw error;
    }
    const current = await ctx.db.get(project._id);
    if (!current) throw new ConvexError("Updated project is unavailable.");
    return JSON.stringify(
      await projectWire(ctx, { project: current, membership: membership }, access, null, [], args.assetOrigin, false)
    );
  },
});
export const remove = internalMutation({
  args: { userId: v.id("users"), slug: v.string(), projectApiId: v.string() },
  handler: async (ctx, args) => {
    const access = await workspaceAccess(ctx, args.slug, args.userId);
    const project = await ctx.db
      .query("projects")
      .withIndex("by_api_id", (q) => q.eq("apiId", apiIdSchema.parse(args.projectApiId)))
      .unique();
    if (!project || project.workspaceId !== access.workspace._id || project.deletedAt != null)
      throw new ConvexError({ status: 404, detail: "Project not found." });
    const membership = await apiProjectMembership(ctx, project, access);
    if (!membership || (membership.role !== "admin" && access.member.role !== "admin"))
      throw new ConvexError({
        status: 403,
        detail: "Only joined workspace or project administrators can delete this project.",
      });
    await beginProjectDeletion(ctx, { project, user: access.user });
  },
});
export const archive = internalMutation({
  args: { userId: v.id("users"), slug: v.string(), projectApiId: v.string(), archived: v.boolean() },
  handler: async (ctx, args) => {
    const access = await workspaceAccess(ctx, args.slug, args.userId);
    const project = await ctx.db
      .query("projects")
      .withIndex("by_api_id", (q) => q.eq("apiId", apiIdSchema.parse(args.projectApiId)))
      .unique();
    // The inherited public POST authority is workspace Admin/Member. It is
    // intentionally separate from both UI authority and public DELETE authority.
    if (args.archived && access.member.role === "guest")
      throw new ConvexError({ status: 403, detail: "You do not have permission to perform this action." });
    if (!args.archived) {
      const membership =
        project && project.workspaceId === access.workspace._id
          ? await apiProjectMembership(ctx, project, access)
          : null;
      if (!membership || (membership.role !== "admin" && access.member.role !== "admin"))
        throw new ConvexError({ status: 403, detail: "You do not have permission to perform this action." });
    }
    if (!project || project.workspaceId !== access.workspace._id || project.deletedAt != null)
      throw new ConvexError({ status: 404, error: "The requested resource does not exist." });
    // REST writes even an unchanged state, matching Django save's timestamp effect.
    await writeProjectArchived(ctx, { project, user: access.user }, project.metadataRevision, args.archived);
  },
});

const headers = {
  ...externalApiHeaders,
  "Access-Control-Allow-Headers": "X-Api-Key, Content-Type",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
};
export const options = httpAction(async () => new Response(null, { status: 204, headers }));
async function writeProjectResponse(
  ctx: ActionCtx,
  request: Request,
  userId: Id<"users">,
  slug: string,
  projectApiId: string | undefined,
  assetOrigin: string,
  responseHeaders: HeadersInit
) {
  let bodyJson;
  let status;
  const body = projectJsonText
    .pipe(request.method === "POST" ? projectApiCreate : projectApiPatch)
    .safeParse(await request.text());
  if (!body.success) {
    return Response.json({ detail: z.flattenError(body.error) }, { status: 400, headers: responseHeaders });
  }
  const writeInput = {
    userId,
    slug,
    bodyJson: JSON.stringify(body.data),
    assetOrigin,
  };
  if (projectApiId !== undefined) {
    bodyJson = await ctx.runMutation(internal.projects.external.patch, {
      ...writeInput,
      projectApiId,
    });
    status = 200;
  } else {
    bodyJson = await ctx.runMutation(internal.projects.external.create, writeInput);
    status = 201;
  }
  return Response.json(projectJsonText.parse(bodyJson), { status, headers: responseHeaders });
}
async function projectResponse(ctx: ActionCtx, request: Request, userId: Id<"users">, responseHeaders: HeadersInit) {
  const url = new URL(request.url);
  const match =
    /^\/api\/v1\/workspaces\/([^/]+)\/(projects-lite(?=\/$)|projects)\/(?:([^/]+)\/((?:archive|summary)\/)?)?$/.exec(
      url.pathname
    );
  if (!match) {
    return Response.json({ detail: "Not found." }, { status: 404, headers: responseHeaders });
  }
  const slug = decodeURIComponent(match[1]);
  const lite = match[2] === "projects-lite";
  const projectApiId = match[3];
  const methods =
    match[4] === "archive/"
      ? ["POST", "DELETE"]
      : lite || match[4] === "summary/"
        ? ["GET", "HEAD"]
        : projectApiId
          ? ["GET", "HEAD", "PATCH", "DELETE"]
          : ["GET", "HEAD", "POST"];
  if (!methods.includes(request.method)) {
    return Response.json({ detail: "Method not allowed." }, { status: 405, headers: responseHeaders });
  }
  const parsedId = projectApiId === undefined ? null : apiIdSchema.safeParse(projectApiId);
  if (parsedId && !parsedId.success) {
    return Response.json({ detail: "Project not found." }, { status: 404, headers: responseHeaders });
  }
  if (match[4] && parsedId) {
    if (match[4] === "summary/") {
      const body = await ctx.runQuery(internal.projects.external.summary, {
        userId,
        slug,
        projectApiId: parsedId.data,
        fields: projectApiSummaryFields.parse(url.searchParams.getAll("fields").at(-1)),
      });
      return Response.json(body, { status: 200, headers: responseHeaders });
    }
    await ctx.runMutation(internal.projects.external.archive, {
      userId,
      slug,
      projectApiId: parsedId.data,
      archived: request.method === "POST",
    });
    return new Response(null, { status: 204, headers: responseHeaders });
  }
  if (request.method === "DELETE" && parsedId) {
    await ctx.runMutation(internal.projects.external.remove, { userId, slug, projectApiId: parsedId.data });
    return new Response(null, { status: 204, headers: responseHeaders });
  }
  let bodyJson;
  let status;
  if (["POST", "PATCH"].includes(request.method))
    return writeProjectResponse(ctx, request, userId, slug, parsedId?.data, url.origin, responseHeaders);
  const readOptions = projectApiReadOptions.safeParse({
    ...(lite ? { order_by: "-created_at" } : {}),
    ...Object.fromEntries(url.searchParams),
  });
  if (!readOptions.success) {
    return Response.json({ detail: "Invalid project query parameter." }, { status: 400, headers: responseHeaders });
  }
  const readInput = {
    userId,
    slug,
    fields: readOptions.data.fields,
    expand: readOptions.data.expand,
    assetOrigin: url.origin,
  };
  if (parsedId)
    bodyJson = await ctx.runQuery(internal.projects.external.read, { ...readInput, projectApiId: parsedId.data });
  else
    bodyJson = await ctx.runQuery(internal.projects.external.list, {
      ...readInput,
      perPage: readOptions.data.per_page,
      page: readOptions.data.cursor,
      orderBy: readOptions.data.order_by,
      lite,
      includeArchived: readOptions.data.include_archived,
    });
  status = 200;
  return Response.json(projectJsonText.parse(bodyJson), { status, headers: responseHeaders });
}
export const projects = httpAction(async (ctx, request) => {
  const startedAt = Date.now();
  let status = 500;
  let userId: Id<"users"> | null = null;
  let keyId: string | null = null;
  let responseHeaders = headers;
  try {
    const credential = await verifyRequest(ctx, request);
    userId = credential.userId;
    keyId = credential.keyId;
    responseHeaders = { ...headers, ...credential.headers };
    if (credential.status !== 200) {
      status = credential.status;
      return Response.json({ detail: credential.detail }, { status, headers: responseHeaders });
    }
    const response = await projectResponse(ctx, request, credential.userId, responseHeaders);
    status = response.status;
    return response;
  } catch (error) {
    if (error instanceof ConvexError) {
      const failure = projectApiFailure.safeParse(error.data);
      if (failure.success) {
        const { status: failureStatus, ...body } = failure.data;
        status = failureStatus;
        return Response.json(body, { status, headers: responseHeaders });
      }
    }
    throw error;
  } finally {
    const metadata = {
      pathname: new URL(request.url).pathname,
      method: request.method,
      status,
      durationMs: Date.now() - startedAt,
      userId,
      keyId,
    };
    console.info("External API request", metadata);
    try {
      await ctx.runMutation(internal.identity.apiAudit.record, apiRequestMetadata.parse(metadata));
    } catch {
      console.error("External API request audit could not be persisted", metadata);
    }
  }
});
