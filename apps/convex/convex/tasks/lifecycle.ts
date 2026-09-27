import type { MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import type { Infer } from "convex/values";
import { ConvexError, v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { mutation, query, internalMutation } from "../_generated/server";
import { requireProject } from "../identity/access";
import { pageBudget } from "../commercial/validation";
import { requireTask, taskDetail, taskRoleCanRead } from "./access";
import { requireTaskRevision, taskChanged } from "./revision";
const MAX_BULK_TASKS = 20;
export const lifecycleOperation = v.union(
  v.literal("archive"),
  v.literal("unarchive"),
  v.literal("delete"),
  v.literal("restore")
);
async function prepareChange(
  ctx: MutationCtx,
  args: { taskId: Id<"tasks">; expectedUpdatedAt: number; operation: Infer<typeof lifecycleOperation> }
) {
  const recovery = args.operation === "delete" || args.operation === "restore";
  const task = await requireTask(ctx, args.taskId, recovery ? "recovery" : "read");
  const { user } = await requireProject(ctx, task.projectId, !recovery);
  requireTaskRevision(task, args.expectedUpdatedAt);
  if (args.operation === "archive" && task.status !== "done" && task.status !== "cancelled")
    throw new ConvexError("Only completed or cancelled tasks can be archived.");
  const field = recovery ? "deletedAt" : "archivedAt";
  const enabled = args.operation === "delete" || args.operation === "archive";
  return { task, user, field, enabled, unchanged: (task[field] != null) === enabled } as const;
}
async function applyChange(ctx: MutationCtx, change: Awaited<ReturnType<typeof prepareChange>>) {
  if (change.unchanged) return false;
  await ctx.db.patch(change.task._id, { [change.field]: change.enabled ? Date.now() : null });
  await taskChanged(ctx, change.task, change.user._id);
  return true;
}
export const change = mutation({
  args: { taskId: v.id("tasks"), expectedUpdatedAt: v.number(), operation: lifecycleOperation },
  handler: async (ctx, args) => {
    await applyChange(ctx, await prepareChange(ctx, args));
  },
});
export const bulkAccess = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    const { member, projectMember } = await requireProject(ctx, args.projectId);
    const writer = member.role !== "guest" && projectMember.role !== "guest";
    return { maxTasks: MAX_BULK_TASKS, canChange: writer, canDelete: writer && projectMember.role === "admin" };
  },
});
export const bulk = mutation({
  args: {
    projectId: v.id("projects"),
    operation: lifecycleOperation,
    tasks: v.array(v.object({ taskId: v.id("tasks"), expectedUpdatedAt: v.number() })),
  },
  handler: async (ctx, args) => {
    const access = await requireProject(ctx, args.projectId, true);
    if (args.operation === "delete" && access.projectMember.role !== "admin")
      throw new ConvexError("Only project administrators can move multiple tasks to Trash.");
    if (
      !args.tasks.length ||
      args.tasks.length > MAX_BULK_TASKS ||
      new Set(args.tasks.map((row) => row.taskId)).size !== args.tasks.length
    )
      throw new ConvexError(`Choose 1–${MAX_BULK_TASKS} distinct tasks.`);
    const changes = await Promise.all(
      args.tasks.map(async (row) => {
        const change = await prepareChange(ctx, { ...row, operation: args.operation });
        if (change.task.projectId !== args.projectId)
          throw new ConvexError("All selected tasks must belong to this project.");
        return change;
      })
    );
    const results = await Promise.all(changes.map((change) => applyChange(ctx, change)));
    return { selected: changes.length, changed: results.filter(Boolean).length };
  },
});
export const list = query({
  args: {
    projectId: v.id("projects"),
    view: v.union(v.literal("archived"), v.literal("deleted")),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const { user, member, projectMember, project } = await requireProject(ctx, args.projectId);
    const result = await ctx.db
      .query("tasks")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .order("desc")
      .paginate(pageBudget(args.paginationOpts));
    return {
      ...result,
      page: result.page
        .filter((task) => task.status !== "triage")
        .filter((task) =>
          args.view === "deleted"
            ? task.deletedAt != null && (task.createdBy === user._id || projectMember.role === "admin")
            : task.deletedAt == null &&
              task.archivedAt != null &&
              taskRoleCanRead(task, user._id, member.role, projectMember.role, !!project.guestViewAllFeatures)
        ),
    };
  },
});
export const get = query({
  args: { taskId: v.string(), view: v.union(v.literal("archived"), v.literal("deleted")) },
  handler: async (ctx, args) => {
    const id = ctx.db.normalizeId("tasks", args.taskId);
    if (!id) throw new ConvexError("Task not found.");
    const task = await requireTask(ctx, id, args.view === "deleted" ? "recovery" : "read");
    if (args.view === "deleted" ? task.deletedAt == null : task.deletedAt != null || task.archivedAt == null)
      throw new ConvexError("Task not found.");
    return taskDetail(ctx, task);
  },
});
export const backfill = internalMutation({
  args: { cursor: v.union(v.string(), v.null()) },
  handler: async (ctx, args) => {
    const result = await ctx.db.query("tasks").paginate({
      cursor: args.cursor,
      numItems: 50,
      maximumRowsRead: 50,
      maximumBytesRead: 1_000_000,
    });
    let changed = 0;
    await Promise.all(
      result.page.map(async (task) => {
        if (task.archivedAt !== undefined && task.deletedAt !== undefined) return;
        await ctx.db.patch(task._id, {
          archivedAt: task.archivedAt ?? null,
          deletedAt: task.deletedAt ?? null,
        });
        changed++;
      })
    );
    return { changed, continueCursor: result.continueCursor, isDone: result.isDone };
  },
});
