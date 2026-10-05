import { ConvexError, v, type Infer } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { stream } from "convex-helpers/server/stream";
import { mutation, query, type QueryCtx } from "../_generated/server";
import { requireProject } from "../identity/access";
import { apiIdSchema } from "../identity/schema";
import { profileIdentity } from "../identity/profile_owner";
import { accountRestricted } from "../identity/deactivation/access";
import { projectAppearance } from "../projects/cover_owner";
import { renderedProjectLogo } from "../projects/branding_schema";
import { pageBudget } from "../commercial/validation";
import { viewFilters } from "../savedViews/schema";
import { matchesFilters, validateShape } from "../savedViews/filters";
import { plainDescriptionHtml } from "../tasks/rich_content";
import { descriptor } from "../assets/access";
import { readTaskCycle } from "../cycles/tasks";
import { readTaskModules } from "../modules/tasks";
import {
  publicationForProject,
  requirePublishedProject,
  requirePublishedTask,
  requirePublishedDescriptionImage,
  requirePublishedCover,
  publishedTask,
} from "./access";
import { defaultPublicationSettings, publicationSettings } from "./schema";
import schema from "../schema";

export const get = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, { projectId }) => {
    const { member, projectMember } = await requireProject(ctx, projectId);
    const publication = await publicationForProject(ctx, projectId);
    return {
      settings: publication?.settings ?? defaultPublicationSettings,
      revision: publication?.revision ?? 0,
      anchor: publication && publication.revokedAt === null ? publication.anchor : null,
      canManage: member.role !== "guest" && projectMember.role !== "guest",
    };
  },
});

// The inherited publication API permits project writers, separately from admin-only project metadata.
// Canonical native access also proves workspace membership; publication never grants membership.
export const save = mutation({
  args: { projectId: v.id("projects"), settings: publicationSettings, expectedRevision: v.number() },
  handler: async (ctx, { projectId, settings, expectedRevision }) => {
    await requireProject(ctx, projectId, true);
    const publication = await publicationForProject(ctx, projectId);
    if (!Number.isSafeInteger(expectedRevision) || expectedRevision !== (publication?.revision ?? 0))
      throw new ConvexError("Publication changed. Reopen its settings before saving.");
    // A revoked link never becomes valid again when this project is republished.
    const anchor = publication && publication.revokedAt === null ? publication.anchor : crypto.randomUUID();
    const collision = await ctx.db
      .query("projectPublications")
      .withIndex("by_anchor", (q) => q.eq("anchor", anchor))
      .unique();
    if (collision && collision._id !== publication?._id) throw new ConvexError("Publication link already exists.");
    const revision = expectedRevision + 1;
    if (publication) await ctx.db.patch(publication._id, { settings, anchor, revision, revokedAt: null });
    else await ctx.db.insert("projectPublications", { projectId, settings, anchor, revision, revokedAt: null });
    return { anchor, revision };
  },
});

export const revoke = mutation({
  args: { projectId: v.id("projects"), expectedRevision: v.number() },
  handler: async (ctx, { projectId, expectedRevision }) => {
    await requireProject(ctx, projectId, true);
    const publication = await publicationForProject(ctx, projectId);
    if (!Number.isSafeInteger(expectedRevision) || expectedRevision !== (publication?.revision ?? 0))
      throw new ConvexError("Publication changed. Reopen its settings before unpublishing.");
    if (!publication || publication.revokedAt !== null) return { revision: expectedRevision };
    const revision = expectedRevision + 1;
    await ctx.db.patch(publication._id, { revokedAt: Date.now(), revision });
    return { revision };
  },
});

export const settings = query({
  args: { anchor: v.string() },
  handler: async (ctx, { anchor }) => {
    const { publication, project, workspace } = await requirePublishedProject(ctx, anchor);
    const appearance = await projectAppearance(ctx, project._id);
    const cover = appearance?.coverAssetId ? await requirePublishedCover(ctx, anchor, appearance.coverAssetId) : null;
    return {
      anchor: publication.anchor,
      settings: publication.settings,
      project: {
        _id: project._id,
        name: project.name,
        identifier: project.identifier,
        description: project.description,
        logoProps: project.logoProps ? renderedProjectLogo(project.logoProps) : null,
        cover: cover
          ? {
              id: cover._id,
              name: cover.name,
              contentType: cover.contentType,
              size: cover.size,
              downloadPath: `/assets/${cover._id}?anchor=${encodeURIComponent(anchor)}&purpose=cover`,
            }
          : null,
        externalCoverUrl: appearance?.externalCoverUrl ?? null,
      },
      workspace: { _id: workspace._id, name: workspace.name, slug: workspace.slug },
    };
  },
});

export const resolveProject = query({
  args: { workspaceSlug: v.string(), projectId: v.string() },
  handler: async (ctx, { workspaceSlug, projectId }) => {
    const apiId = apiIdSchema.safeParse(projectId);
    if (!apiId.success) throw new ConvexError("Project is not published.");
    const project = await ctx.db
      .query("projects")
      .withIndex("by_api_id", (q) => q.eq("apiId", apiId.data))
      .unique();
    const publication = project ? await publicationForProject(ctx, project._id) : null;
    if (!publication || publication.revokedAt !== null) throw new ConvexError("Project is not published.");
    const { workspace } = await requirePublishedProject(ctx, publication.anchor);
    if (workspace.slug !== workspaceSlug) throw new ConvexError("Project is not published.");
    return { anchor: publication.anchor };
  },
});

// This projection is the anonymous boundary: no internal permissions, email, events or discussion.
function publicTask(task: Awaited<ReturnType<typeof requirePublishedTask>>["task"]) {
  return {
    _id: task._id,
    title: task.title,
    sequence: task.sequence,
    status: task.status,
    stateId: task.stateId,
    priority: task.priority,
    startDate: task.startDate,
    targetDate: task.targetDate,
    assigneeIds: task.assigneeIds,
    labelIds: task.labelIds,
    createdBy: task.createdBy,
    createdAt: task._creationTime,
    updatedAt: task.updatedAt,
    sortOrder: task.sortOrder,
    estimatePointId: task.estimatePointId,
  };
}

const listArgs = v.object({
  anchor: v.string(),
  filters: v.optional(viewFilters),
  stateId: v.optional(v.union(v.id("taskStates"), v.null())),
  paginationOpts: paginationOptsValidator,
});
async function publishedTasks(ctx: QueryCtx, args: Infer<typeof listArgs>) {
  const access = await requirePublishedProject(ctx, args.anchor);
  if (args.filters) validateShape(args.filters);
  return stream(ctx.db, schema)
    .query("tasks")
    .withIndex("by_project", (q) => q.eq("projectId", access.project._id))
    .order("desc")
    .map(async (task) =>
      publishedTask(task, access) &&
      (!args.filters || (await matchesFilters(ctx, task, args.filters))) &&
      (args.stateId === undefined || task.stateId === args.stateId)
        ? task
        : null
    );
}
export const list = query({
  args: listArgs.fields,
  handler: async (ctx, args) =>
    (await publishedTasks(ctx, args)).map(async (task) => publicTask(task)).paginate(pageBudget(args.paginationOpts)),
});

// Exact totals require exhausting these lightweight contributions, including the null-state cohort.
export const summary = query({
  args: listArgs.fields,
  handler: async (ctx, args) =>
    (await publishedTasks(ctx, args))
      .map(async (task) => ({ taskId: task._id, stateId: task.stateId }))
      .paginate(pageBudget(args.paginationOpts)),
});

export const getTask = query({
  args: { anchor: v.string(), taskId: v.string() },
  handler: async (ctx, { anchor, taskId }) => {
    const id = ctx.db.normalizeId("tasks", taskId);
    if (!id) throw new ConvexError("Work item is not published.");
    const { task } = await requirePublishedTask(ctx, anchor, id);
    const [description, cycle, modules] = await Promise.all([
      ctx.db
        .query("taskDescriptions")
        .withIndex("by_task", (q) => q.eq("taskId", task._id))
        .unique(),
      readTaskCycle(ctx, task),
      readTaskModules(ctx, task),
    ]);
    return {
      ...publicTask(task),
      description: task.description,
      descriptionHtml: description?.html ?? plainDescriptionHtml(task.description),
      cycleId: cycle.cycle && !cycle.cycle.deleted && !cycle.cycle.archived ? cycle.cycle._id : null,
      moduleIds: modules.filter(({ module }) => !module.deleted && !module.archived).map(({ module }) => module._id),
    };
  },
});

export const catalog = query({
  args: { anchor: v.string() },
  handler: async (ctx, { anchor }) => {
    const { project } = await requirePublishedProject(ctx, anchor);
    const [states, labels] = await Promise.all([
      ctx.db
        .query("taskStates")
        .withIndex("by_project_order", (q) => q.eq("projectId", project._id))
        .collect(),
      ctx.db
        .query("taskLabels")
        .withIndex("by_project_order", (q) => q.eq("projectId", project._id))
        .collect(),
    ]);
    return {
      states: states
        .filter((state) => state.workspaceId === project.workspaceId && state.status !== "triage")
        .map((state) => ({
          _id: state._id,
          name: state.name,
          status: state.status,
          color: state.color,
          sortOrder: state.sortOrder,
        })),
      labels: labels
        .filter((label) => label.workspaceId === project.workspaceId && !label.retiring)
        .map((label) => ({ _id: label._id, name: label.name, color: label.color, parentId: label.parentId })),
    };
  },
});

export const members = query({
  args: { anchor: v.string(), paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const { project } = await requirePublishedProject(ctx, args.anchor);
    return stream(ctx.db, schema)
      .query("projectMembers")
      .withIndex("by_project_role_active", (q) => q.eq("projectId", project._id))
      .map(async (member) => {
        if (!member.active || member.workspaceId !== project.workspaceId) return null;
        const workspaceMember = await ctx.db
          .query("workspaceMembers")
          .withIndex("by_workspace_user", (q) => q.eq("workspaceId", project.workspaceId).eq("userId", member.userId))
          .unique();
        if (!workspaceMember?.active || (await accountRestricted(ctx, member.userId))) return null;
        const identity = await profileIdentity(ctx, member.userId);
        return identity
          ? { userId: identity.userId, name: identity.fullName || identity.displayName?.trim() || null }
          : null;
      })
      .paginate(pageBudget(args.paginationOpts));
  },
});

export const cycles = query({
  args: { anchor: v.string(), paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const { project } = await requirePublishedProject(ctx, args.anchor);
    return stream(ctx.db, schema)
      .query("cycles")
      .withIndex("by_project", (q) => q.eq("projectId", project._id).eq("deleted", false))
      .map(async (cycle) =>
        cycle.workspaceId === project.workspaceId && !cycle.archived ? { _id: cycle._id, name: cycle.name } : null
      )
      .paginate(pageBudget(args.paginationOpts));
  },
});

export const modules = query({
  args: { anchor: v.string(), paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const { project } = await requirePublishedProject(ctx, args.anchor);
    return stream(ctx.db, schema)
      .query("modules")
      .withIndex("by_project", (q) => q.eq("projectId", project._id).eq("deleted", false))
      .map(async (module) =>
        module.workspaceId === project.workspaceId && !module.archived ? { _id: module._id, name: module.name } : null
      )
      .paginate(pageBudget(args.paginationOpts));
  },
});

export const resolveDescriptionImage = query({
  args: { anchor: v.string(), taskId: v.id("tasks"), assetId: v.string() },
  handler: async (ctx, { anchor, taskId, assetId }) => {
    const asset = await requirePublishedDescriptionImage(ctx, anchor, taskId, assetId);
    return {
      ...descriptor(asset),
      downloadPath: `/assets/${asset._id}?${new URLSearchParams({ anchor, task: taskId })}`,
    };
  },
});
