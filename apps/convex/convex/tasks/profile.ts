import { mergedStream, stream } from "convex-helpers/server/stream";
import { paginationOptsValidator } from "convex/server";
import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import { query, type QueryCtx } from "../_generated/server";
import { pageBudget } from "../commercial/validation";
import { requireWorkspace } from "../identity/access";
import { personalImageDescriptor, userAppearance } from "../identity/avatar_owner";
import { defaultProfile } from "../identity/profile_owner";
import { renderedProjectLogo } from "../projects/branding_schema";
import { projectReader } from "../savedViews/scope";
import schema from "../schema";
import { taskIsActive, taskRoleCanRead } from "./access";
import { priority, status } from "./schema";

// Canonical rows own the counts. A project membership contributes its metadata
// even when it has no tasks; task rows contribute only their actual relationships.
function projectContribution(
  project: Doc<"projects">,
  task: Doc<"tasks"> | null,
  subjectId: Id<"users">,
  subscribed: boolean
) {
  const active = task !== null && taskIsActive(task);
  const assigned = active && task.assigneeIds.includes(subjectId);
  return {
    projectId: project._id,
    name: project.name,
    identifier: project.identifier,
    logo: renderedProjectLogo(project.logoProps ?? {}),
    createdCount: Number(active && task.createdBy === subjectId),
    assignedCount: Number(assigned),
    subscribedCount: Number(subscribed),
    completedByTimestamp: Number(assigned && task.completedAt !== null),
    completedCount: Number(assigned && task.status === "done"),
    pendingCount: Number(assigned && task.status !== "done" && task.status !== "cancelled"),
    statusDistribution: status.members.map(({ value }) => ({
      status: value,
      count: Number(assigned && task.status === value),
    })),
    priorityDistribution: priority.members.map(({ value }) => ({
      priority: value,
      count: Number(assigned && task.priority === value),
    })),
  };
}

const subjectArgs = { workspaceId: v.id("workspaces"), userId: v.string() };
export async function requireSubject(ctx: QueryCtx, workspaceId: Id<"workspaces">, rawUserId: string) {
  const access = await requireWorkspace(ctx, workspaceId);
  const userId = ctx.db.normalizeId("users", rawUserId);
  if (!userId) throw new ConvexError("Workspace member not found.");
  const [target, membership] = await Promise.all([
    ctx.db.get(userId),
    ctx.db
      .query("workspaceMembers")
      .withIndex("by_workspace_user", (q) => q.eq("workspaceId", workspaceId).eq("userId", userId))
      .unique(),
  ]);
  if (!target || !membership?.active) throw new ConvexError("Workspace member not found.");
  return { access, target };
}

/** Workspace-visible identity only; private account settings stay self-only. */
export const subject = query({
  args: subjectArgs,
  handler: async (ctx, args) => {
    const { access, target } = await requireSubject(ctx, args.workspaceId, args.userId);
    const [storedProfile, appearance] = await Promise.all([
      ctx.db
        .query("userProfiles")
        .withIndex("by_user", (q) => q.eq("userId", target._id))
        .unique(),
      userAppearance(ctx, target._id),
    ]);
    const profile = storedProfile ?? defaultProfile;
    const [avatar, cover] = await Promise.all([
      personalImageDescriptor(ctx, appearance, "avatar", args.workspaceId),
      personalImageDescriptor(ctx, appearance, "cover", args.workspaceId),
    ]);
    return {
      userId: target._id,
      displayName: target.name ?? null,
      firstName: profile.firstName,
      lastName: profile.lastName,
      timezone: profile.timezone,
      accountCreatedAt: target._creationTime,
      avatar,
      cover,
      externalCoverUrl: appearance?.externalCoverUrl ?? null,
      canEditProfile: access.user._id === target._id,
      canViewTaskTabs: access.member.role !== "guest",
      canExportActivity: access.member.role !== "guest",
    };
  },
});

/** Exact contributions from canonical rows; global totals require exhausting
 * the helpers React paginator on one consistent Convex client. */
export const summary = query({
  args: { ...subjectArgs, paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const { access, target } = await requireSubject(ctx, args.workspaceId, args.userId);
    const read = projectReader(ctx, args.workspaceId, access.user._id);
    const database = stream(ctx.db, schema);
    const tasks = database
      .query("tasks")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .order("desc")
      .map(async (task) => {
        if (task.deletedAt !== null) return null;
        const scope = await read(task.projectId);
        if (
          !scope ||
          !taskRoleCanRead(
            task,
            access.user._id,
            access.member.role,
            scope.member.role,
            !!scope.project.guestViewAllFeatures
          )
        )
          return null;
        const subscription = await ctx.db
          .query("taskSubscriptions")
          .withIndex("by_task_user", (q) => q.eq("taskId", task._id).eq("userId", target._id))
          .unique();
        const contribution = projectContribution(scope.project, task, target._id, subscription !== null);
        return contribution.createdCount || contribution.assignedCount || contribution.subscribedCount
          ? contribution
          : null;
      });
    const projects = database
      .query("projectMembers")
      .withIndex("by_workspace_user_active", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("userId", access.user._id).eq("active", true)
      )
      .order("desc")
      .map(async (member) => {
        const scope = await read(member.projectId);
        return scope ? projectContribution(scope.project, null, target._id, false) : null;
      });
    const result = await mergedStream([tasks, projects], ["_creationTime"]).paginate(pageBudget(args.paginationOpts));
    return { ...result, coverage: "page" as const };
  },
});
