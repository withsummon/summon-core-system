import { validateProjectMetadata, validateProjectLead } from "./metadata_fields";
import { grantProjectMembership } from "./index";
import { renderedProjectLogo } from "./branding_schema";
import { initializeProjectOrder } from "./order_owner";
import { workspaceTimezone, validateTimezone } from "../settings/timezone";
import { ConvexError, type Infer } from "convex/values";
import { apiIdSchema } from "../identity/schema";
import { projectApiData, projectCreateInput, type projectCreateArgs } from "./schema";
import { writeInactivityPolicy } from "./inactivity";
import { setExternalCover } from "./cover_owner";
import type { MutationCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import type { requireWorkspaceForUser } from "../identity/access";
import { taskStatus, allocateTaskStateApiId } from "../tasks/schema";

const defaultStates = {
  backlog: { name: "Backlog", color: "#60646C", sortOrder: 15000 },
  todo: { name: "Todo", color: "#60646C", sortOrder: 25000 },
  in_progress: { name: "In Progress", color: "#F59E0B", sortOrder: 35000 },
  done: { name: "Done", color: "#46A758", sortOrder: 45000 },
  cancelled: { name: "Cancelled", color: "#9AA4BC", sortOrder: 55000 },
  triage: { name: "Triage", color: "#4E5355", sortOrder: 65000 },
} satisfies Record<Infer<typeof taskStatus>, Pick<Doc<"taskStates">, "name" | "color" | "sortOrder">>;

export async function createProject(
  ctx: MutationCtx,
  args: Infer<typeof projectCreateArgs>,
  access: Awaited<ReturnType<typeof requireWorkspaceForUser>>
): Promise<Id<"projects">> {
  const { user } = access;
  const {
    description,
    leadId,
    defaultAssigneeId,
    logoProps,
    features,
    network,
    intakeEnabled,
    guestViewAllFeatures,
    archiveMonths,
    closeMonths,
  } = projectCreateInput.parse(args);
  if (access.workspace._id !== args.workspaceId || access.member.role === "guest")
    throw new ConvexError("You do not have access to create projects in this workspace.");
  renderedProjectLogo(logoProps);
  const metadata = await validateProjectMetadata(ctx, args.workspaceId, {
    ...args,
    description,
  });
  await validateProjectLead(ctx, args.workspaceId, leadId);
  if (defaultAssigneeId) {
    const membership = await ctx.db
      .query("workspaceMembers")
      .withIndex("by_workspace_user", (q) => q.eq("workspaceId", args.workspaceId).eq("userId", defaultAssigneeId))
      .unique();
    if (!membership || !(await ctx.db.get(defaultAssigneeId)))
      throw new ConvexError("Default assignee must belong to this workspace.");
  }
  const apiData = projectApiData.parse(args);
  const projectId = await ctx.db.insert("projects", {
    workspaceId: args.workspaceId,
    ...metadata,
    ...apiData,
    apiId: await allocateProjectApiId(ctx),
    createdById: user._id,
    updatedById: null,
    updatedAt: Date.now(),
    archivedAt: null,
    leadId,
    defaultAssigneeId,
    defaultStateId: null,
    timezone:
      args.timezone === undefined ? await workspaceTimezone(ctx, args.workspaceId) : validateTimezone(args.timezone),
    metadataRevision: 0,
    features,
    network,
    logoProps,
    intakeEnabled,
    guestViewAllFeatures,
    nextSequence: 1,
    archived: false,
    deletedAt: null,
  });
  await ctx.db.insert("projectMembers", {
    workspaceId: args.workspaceId,
    projectId,
    userId: user._id,
    role: "admin",
    active: true,
    revision: 0,
    apiSortOrder: 65535,
  });
  for (const state of taskStatus.members) {
    // Sequential inserts make the indexed UUID check observe earlier allocations in this transaction.
    // oxlint-disable-next-line no-await-in-loop
    const apiId = await allocateTaskStateApiId(ctx);
    // oxlint-disable-next-line no-await-in-loop
    await ctx.db.insert("taskStates", {
      apiId,
      ...defaultStates[state.value],
      status: state.value,
      description: "",
      isDefault: state.value === "backlog",
      projectId,
      workspaceId: args.workspaceId,
    });
  }
  await initializeProjectOrder(ctx, { workspaceId: args.workspaceId, projectId, userId: user._id });
  if (leadId && leadId !== user._id)
    await grantProjectMembership(ctx, {
      workspaceId: args.workspaceId,
      projectId,
      userId: leadId,
      role: "admin",
    });
  if (args.externalCoverUrl != null) await setExternalCover(ctx, projectId, null, args.externalCoverUrl);
  if (archiveMonths || closeMonths) {
    const states = await ctx.db
      .query("taskStates")
      .withIndex("by_project_order", (q) => q.eq("projectId", projectId))
      .collect();
    const cancelled = states.find((state) => state.status === "cancelled");
    if (!cancelled) throw new ConvexError("Project cancellation state is unavailable.");
    await writeInactivityPolicy(
      ctx,
      { projectId, workspaceId: args.workspaceId, configuredBy: user._id },
      {
        archiveMonths,
        close: closeMonths ? { months: closeMonths, stateId: cancelled._id } : null,
      },
      null
    );
  }
  return projectId;
}

async function allocateProjectApiId(ctx: MutationCtx) {
  const apiId = apiIdSchema.parse(crypto.randomUUID());
  const existing = await ctx.db
    .query("projects")
    .withIndex("by_api_id", (q) => q.eq("apiId", apiId))
    .unique();
  if (existing) throw new ConvexError("Project API identifier already exists.");
  return apiId;
}
