import { ConvexError, v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { mutation, query } from "../_generated/server";
import type { QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { requireProject } from "../identity/access";
import { pageBudget } from "../commercial/validation";
import { taskIsActive } from "../tasks/access";
import { taskChanged } from "../tasks/revision";
import { requireCycle, requireCycleRevision, requireOpenCycle } from "./access";
import { cyclePhase } from "./dates";
import { snapshot } from "./transfer_snapshot";
export const TRANSFER_TASK_LIMIT = 100;
export const TRANSFER_BATCH_SIZE = 20;
export const SNAPSHOT_BYTES_LIMIT = 524288;
function sourceAvailable(cycle: Doc<"cycles">) {
  if (cycle.deleted || cycle.archived || cyclePhase(cycle) !== "completed")
    throw new ConvexError("Transfer requires a completed, unarchived source cycle.");
}
function unfinished(task: Doc<"tasks">) {
  return taskIsActive(task) && task.status !== "done" && task.status !== "cancelled";
}
async function requireJob(ctx: QueryCtx, id: Id<"cycleTransfers">) {
  const job = await ctx.db.get(id);
  if (!job) throw new ConvexError("Transfer not found.");
  const access = await requireProject(ctx, job.projectId, true);
  return { ...access, job };
}
function revision(job: Doc<"cycleTransfers">, expected: number) {
  if (job.revision !== expected) throw new ConvexError("Transfer changed. Review its latest progress.");
}
async function changed(ctx: QueryCtx, job: Doc<"cycleTransfers">, entry: Doc<"cycleTransfers">["entries"][number]) {
  const [task, membership] = await Promise.all([ctx.db.get(entry.taskId), ctx.db.get(entry.membershipId)]);
  if (!task || task.projectId !== job.projectId || !unfinished(task))
    return { task, reason: "Task is no longer active and unfinished." };
  if (!membership || membership.taskId !== entry.taskId || membership.cycleId !== job.sourceId)
    return { task, reason: "Task cycle membership changed." };
  if (task.updatedAt !== entry.expectedUpdatedAt) return { task, reason: "Task changed after the transfer snapshot." };
  return { task, reason: null };
}
export const list = query({
  args: { cycleId: v.id("cycles"), paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    await requireCycle(ctx, args.cycleId, true);
    return ctx.db
      .query("cycleTransfers")
      .withIndex("by_source", (q) => q.eq("sourceId", args.cycleId))
      .order("desc")
      .paginate(pageBudget(args.paginationOpts));
  },
});
export const inspect = query({
  args: { transferId: v.id("cycleTransfers") },
  handler: async (ctx, args) => {
    const { job } = await requireJob(ctx, args.transferId);
    const pending = job.entries.filter((entry) => entry.outcome === "pending").slice(0, TRANSFER_BATCH_SIZE);
    const blockers = await Promise.all(
      pending.map(async (entry) => {
        const result = await changed(ctx, job, entry);
        return result.reason
          ? {
              taskId: entry.taskId,
              title:
                result.task && result.task.projectId === job.projectId && taskIsActive(result.task)
                  ? result.task.title
                  : "Unavailable task",
              reason: result.reason,
            }
          : null;
      })
    );
    return { job, blockers: blockers.filter((row) => row !== null) };
  },
});
export const begin = mutation({
  args: {
    sourceId: v.id("cycles"),
    destinationId: v.id("cycles"),
    expectedSourceUpdatedAt: v.number(),
    expectedDestinationUpdatedAt: v.number(),
  },
  handler: async (ctx, args) => {
    const { cycle: source, user } = await requireCycle(ctx, args.sourceId, true);
    sourceAvailable(source);
    requireCycleRevision(source, args.expectedSourceUpdatedAt);
    const { cycle: destination } = await requireCycle(ctx, args.destinationId, true);
    requireOpenCycle(destination);
    requireCycleRevision(destination, args.expectedDestinationUpdatedAt);
    if (source._id === destination._id || source.projectId !== destination.projectId)
      throw new ConvexError("Choose another open cycle in this project.");
    const running = await ctx.db
      .query("cycleTransfers")
      .withIndex("by_source_status", (q) => q.eq("sourceId", source._id).eq("status", "running"))
      .unique();
    if (running) throw new ConvexError("Continue or cancel the existing transfer first.");
    const memberships = await ctx.db
      .query("cycleTasks")
      .withIndex("by_cycle", (q) => q.eq("cycleId", source._id))
      .take(TRANSFER_TASK_LIMIT + 1);
    if (memberships.length > TRANSFER_TASK_LIMIT)
      throw new ConvexError("Source cycle exceeds the 100-task transfer limit.");
    const records = await Promise.all(
      memberships.map(async (membership) => ({ membership, task: await ctx.db.get(membership.taskId) }))
    );
    const active = records.flatMap((row) =>
      row.task && row.task.projectId === source.projectId && taskIsActive(row.task)
        ? [{ membership: row.membership, task: row.task }]
        : []
    );
    const entries = active
      .filter((row) => unfinished(row.task))
      .map(({ membership, task }) => ({
        taskId: task._id,
        membershipId: membership._id,
        expectedUpdatedAt: task.updatedAt,
        outcome: "pending" as const,
        skipReason: null,
      }));
    if (!entries.length) throw new ConvexError("No unfinished tasks to transfer.");
    const stats = await snapshot(
      ctx,
      active.map((row) => row.task),
      source
    );
    if (new TextEncoder().encode(JSON.stringify(stats)).length > SNAPSHOT_BYTES_LIMIT)
      throw new ConvexError("Transfer snapshot exceeds its 512 KiB limit.");
    const id = await ctx.db.insert("cycleTransfers", {
      projectId: source.projectId,
      sourceId: source._id,
      destinationId: destination._id,
      actorId: user._id,
      snapshot: stats,
      entries,
      status: "running",
      revision: 0,
    });
    await ctx.db.patch(source._id, { updatedAt: Math.max(Date.now(), source.updatedAt + 1) });
    return id;
  },
});
export const step = mutation({
  args: { transferId: v.id("cycleTransfers"), expectedRevision: v.number() },
  handler: async (ctx, args) => {
    const { job, user } = await requireJob(ctx, args.transferId);
    revision(job, args.expectedRevision);
    if (job.status !== "running") throw new ConvexError("Transfer is not running.");
    const { cycle: source } = await requireCycle(ctx, job.sourceId, true);
    sourceAvailable(source);
    const { cycle: destination } = await requireCycle(ctx, job.destinationId, true);
    requireOpenCycle(destination);
    const batch = job.entries.filter((entry) => entry.outcome === "pending").slice(0, TRANSFER_BATCH_SIZE);
    const checked = await Promise.all(batch.map((entry) => changed(ctx, job, entry)));
    if (checked.some((row) => row.reason))
      throw new ConvexError("Tasks changed after the snapshot. Review and explicitly skip them before continuing.");
    const destinationRows = await ctx.db
      .query("cycleTasks")
      .withIndex("by_cycle", (q) => q.eq("cycleId", destination._id))
      .take(TRANSFER_TASK_LIMIT + 1);
    if (destinationRows.length + batch.length > TRANSFER_TASK_LIMIT)
      throw new ConvexError("Destination cycle has insufficient capacity. Free space before continuing.");
    await Promise.all(
      batch.map(async (entry, index) => {
        const task = checked[index].task;
        if (!task) throw new ConvexError("Task not found.");
        await ctx.db.patch(entry.membershipId, { cycleId: destination._id });
        await taskChanged(ctx, task, user._id, {
          kind: "updated",
          changes: [
            {
              field: "cycle",
              before: { id: source._id, name: source.name },
              after: { id: destination._id, name: destination.name },
            },
          ],
        });
      })
    );
    const moved = new Set(batch.map((entry) => entry.taskId));
    const entries = job.entries.map((entry) =>
      moved.has(entry.taskId) ? { ...entry, outcome: "moved" as const } : entry
    );
    await ctx.db.patch(job._id, {
      entries,
      status: entries.some((entry) => entry.outcome === "pending") ? "running" : "completed",
      revision: job.revision + 1,
    });
    await Promise.all(
      [source, destination].map((cycle) =>
        ctx.db.patch(cycle._id, { updatedAt: Math.max(Date.now(), cycle.updatedAt + 1) })
      )
    );
  },
});
export const skipChanged = mutation({
  args: { transferId: v.id("cycleTransfers"), expectedRevision: v.number(), taskIds: v.array(v.id("tasks")) },
  handler: async (ctx, args) => {
    const { job } = await requireJob(ctx, args.transferId);
    revision(job, args.expectedRevision);
    if (job.status !== "running") throw new ConvexError("Transfer is not running.");
    if (
      !args.taskIds.length ||
      args.taskIds.length > TRANSFER_BATCH_SIZE ||
      new Set(args.taskIds).size !== args.taskIds.length
    )
      throw new ConvexError("Choose 1–20 distinct changed tasks.");
    const updates = await Promise.all(
      args.taskIds.map(async (taskId) => {
        const entry = job.entries.find((row) => row.taskId === taskId && row.outcome === "pending");
        if (!entry) throw new ConvexError("Task is not pending in this transfer.");
        const result = await changed(ctx, job, entry);
        if (!result.reason) throw new ConvexError("Only changed tasks may be skipped.");
        return { ...entry, outcome: "skipped" as const, skipReason: result.reason };
      })
    );
    const entries = job.entries.map((entry) => updates.find((row) => row.taskId === entry.taskId) ?? entry);
    await ctx.db.patch(job._id, {
      entries,
      status: entries.some((entry) => entry.outcome === "pending") ? "running" : "completed",
      revision: job.revision + 1,
    });
  },
});
export const cancel = mutation({
  args: { transferId: v.id("cycleTransfers"), expectedRevision: v.number() },
  handler: async (ctx, args) => {
    const { job } = await requireJob(ctx, args.transferId);
    revision(job, args.expectedRevision);
    if (job.status !== "running") throw new ConvexError("Transfer is not running.");
    await ctx.db.patch(job._id, { status: "cancelled", revision: job.revision + 1 });
  },
});
