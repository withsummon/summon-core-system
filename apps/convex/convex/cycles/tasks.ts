import type { MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { cyclePhase } from "./dates";
import { v, ConvexError } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { stream } from "convex-helpers/server/stream";
import schema from "../schema";
import { mutation, query } from "../_generated/server";
import { requireTask, taskIsActive, taskCanRead, taskDetail } from "../tasks/access";
import { requireProject } from "../identity/access";
import { requireTaskRevision, taskChanged } from "../tasks/revision";
import { requireCycle, requireCycleRevision, requireOpenCycle } from "./access";
export const assign = mutation({
  args: {
    cycleId: v.id("cycles"),
    taskId: v.id("tasks"),
    expectedTaskUpdatedAt: v.number(),
    expectedCycleUpdatedAt: v.number(),
  },
  handler: assignCycleTask,
});
export const remove = mutation({
  args: {
    cycleId: v.id("cycles"),
    taskId: v.id("tasks"),
    expectedTaskUpdatedAt: v.number(),
    expectedCycleUpdatedAt: v.number(),
  },
  handler: removeCycleTask,
});
export const current = query({
  args: { taskId: v.id("tasks") },
  handler: async (ctx, args) => {
    const task = await requireTask(ctx, args.taskId, "read");
    await requireProject(ctx, task.projectId);
    const membership = await ctx.db
      .query("cycleTasks")
      .withIndex("by_task", (q) => q.eq("taskId", task._id))
      .unique();
    const cycle = membership ? await ctx.db.get(membership.cycleId) : null;
    return cycle && !cycle.deleted ? cycle : null;
  },
});
export const list = query({
  args: { cycleId: v.id("cycles"), paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const { cycle, user, member, projectMember } = await requireCycle(ctx, args.cycleId);
    const canDetach =
      member.role !== "guest" && projectMember.role !== "guest" && !cycle.archived && cyclePhase(cycle) !== "completed";
    if (
      !Number.isSafeInteger(args.paginationOpts.numItems) ||
      args.paginationOpts.numItems < 1 ||
      args.paginationOpts.numItems > 100
    )
      throw new ConvexError("Choose 1–100 tasks per page.");
    return stream(ctx.db, schema)
      .query("cycleTasks")
      .withIndex("by_cycle", (q) => q.eq("cycleId", args.cycleId))
      .map(async (row) => {
        const task = await ctx.db.get(row.taskId);
        if (!task || task.projectId !== cycle.projectId || task.workspaceId !== cycle.workspaceId) return null;
        const readable = taskIsActive(task) && (await taskCanRead(ctx, task, user._id));
        if (!readable && !canDetach) return null;
        return {
          taskId: task._id,
          updatedAt: task.updatedAt,
          task: readable ? await taskDetail(ctx, task) : null,
          unavailable: !taskIsActive(task),
        };
      })
      .paginate({ ...args.paginationOpts, maximumRowsRead: 100, maximumBytesRead: 1_048_576 });
  },
});

export async function assignCycleTask(
  ctx: MutationCtx,
  args: { cycleId: Id<"cycles">; taskId: Id<"tasks">; expectedTaskUpdatedAt: number; expectedCycleUpdatedAt: number }
) {
  const { cycle, user } = await requireCycle(ctx, args.cycleId, true);
  requireOpenCycle(cycle);
  requireCycleRevision(cycle, args.expectedCycleUpdatedAt);
  const task = await requireTask(ctx, args.taskId);
  if (task.projectId !== cycle.projectId) throw new ConvexError("Task belongs to another project.");
  const previous = await ctx.db
    .query("cycleTasks")
    .withIndex("by_task", (q) => q.eq("taskId", task._id))
    .unique();
  if (previous?.cycleId === cycle._id) return;
  requireTaskRevision(task, args.expectedTaskUpdatedAt);
  const source = previous ? await ctx.db.get(previous.cycleId) : null;
  if (source && source.projectId !== task.projectId)
    throw new ConvexError("Cycle reference belongs to another project.");
  if (source && !source.deleted) requireOpenCycle(source);
  if (
    (
      await ctx.db
        .query("cycleTasks")
        .withIndex("by_cycle", (q) => q.eq("cycleId", cycle._id))
        .take(100)
    ).length >= 100
  )
    throw new ConvexError("This cycle has reached its 100 task limit.");
  if (previous) await ctx.db.patch(previous._id, { cycleId: cycle._id });
  else await ctx.db.insert("cycleTasks", { cycleId: cycle._id, taskId: task._id });
  await taskChanged(ctx, task, user._id, {
    kind: "updated",
    changes: [
      {
        field: "cycle",
        before: previous ? { id: previous.cycleId, name: source?.name ?? null } : null,
        after: { id: cycle._id, name: cycle.name },
      },
    ],
  });
}

export async function removeCycleTask(
  ctx: MutationCtx,
  args: { cycleId: Id<"cycles">; taskId: Id<"tasks">; expectedTaskUpdatedAt: number; expectedCycleUpdatedAt: number }
) {
  const { cycle, user } = await requireCycle(ctx, args.cycleId, true);
  requireOpenCycle(cycle);
  requireCycleRevision(cycle, args.expectedCycleUpdatedAt);
  const task = await ctx.db.get(args.taskId);
  if (!task) throw new ConvexError("Task not found.");
  if (task.projectId !== cycle.projectId) throw new ConvexError("Task belongs to another project.");
  const previous = await ctx.db
    .query("cycleTasks")
    .withIndex("by_task", (q) => q.eq("taskId", task._id))
    .unique();
  if (!previous) return;
  if (previous.cycleId !== cycle._id) throw new ConvexError("Task has moved to another cycle.");
  requireTaskRevision(task, args.expectedTaskUpdatedAt);
  await ctx.db.delete(previous._id);
  await taskChanged(ctx, task, user._id, {
    kind: "updated",
    changes: [{ field: "cycle", before: { id: cycle._id, name: cycle.name }, after: null }],
  });
}
