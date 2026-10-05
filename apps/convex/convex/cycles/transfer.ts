import { ConvexError, v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { mutation, query } from "../_generated/server";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { requireProject } from "../identity/access";
import { pageBudget } from "../commercial/validation";
import { taskIsActive } from "../tasks/access";
import { taskChanged } from "../tasks/revision";
import { requireCycle, requireCycleRevision, requireOpenCycle } from "./access";
import { cycleDay, cyclePhase } from "./dates";
import { snapshot, requireTransferDocumentSize } from "./transfer_snapshot";
export const TRANSFER_BATCH_SIZE = 20;
export const TRANSFER_CAPTURE_SIZE = 5;
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
async function changed(ctx: QueryCtx, job: Doc<"cycleTransfers">, entry: Doc<"cycleTransferEntries">) {
  const [task, membership] = await Promise.all([ctx.db.get(entry.taskId), ctx.db.get(entry.membershipId)]);
  if (!task || task.projectId !== job.projectId || !unfinished(task))
    return { task, reason: "Task is no longer active and unfinished." };
  if (!membership || membership.taskId !== entry.taskId || membership.cycleId !== job.sourceId)
    return { task, reason: "Task cycle membership changed." };
  if (task.updatedAt !== entry.expectedUpdatedAt) return { task, reason: "Task changed after the transfer snapshot." };
  return { task, reason: null };
}
async function pendingEntries(ctx: QueryCtx, job: Doc<"cycleTransfers">) {
  return ctx.db
    .query("cycleTransferEntries")
    .withIndex("by_transfer_outcome", (q) => q.eq("transferId", job._id).eq("outcome", "pending"))
    .take(TRANSFER_BATCH_SIZE);
}
async function capture(
  ctx: MutationCtx,
  job: Doc<"cycleTransfers">,
  source: Doc<"cycles">,
  viewerWorkspaceRole: Doc<"workspaceMembers">["role"]
) {
  requireCycleRevision(source, job.sourceUpdatedAt);
  const page = await ctx.db
    .query("cycleTasks")
    .withIndex("by_cycle", (q) => q.eq("cycleId", source._id))
    .paginate({
      cursor: job.captureCursor,
      numItems: TRANSFER_CAPTURE_SIZE,
      maximumRowsRead: TRANSFER_CAPTURE_SIZE,
      maximumBytesRead: 1_048_576,
    });
  const tasks = (await Promise.all(page.page.map((row) => ctx.db.get(row.taskId)))).flatMap((task) =>
    task && task.projectId === source.projectId && task.workspaceId === source.workspaceId && taskIsActive(task)
      ? [task]
      : []
  );
  const entries = page.page.flatMap((membership) => {
    const task = tasks.find((candidate) => candidate._id === membership.taskId);
    return task && unfinished(task)
      ? [
          {
            transferId: job._id,
            taskId: task._id,
            membershipId: membership._id,
            expectedUpdatedAt: task.updatedAt,
            outcome: "pending" as const,
            skipReason: null,
          },
        ]
      : [];
  });
  await Promise.all(
    entries.map((entry) => {
      requireTransferDocumentSize(entry);
      return ctx.db.insert("cycleTransferEntries", entry);
    })
  );
  const captured = await snapshot(ctx, tasks, source, job, viewerWorkspaceRole);
  const captureCompletedAt = page.isDone ? Date.now() : null;
  const update = {
    snapshot: {
      ...captured,
      captureCompletedAt,
      asOfDay: captureCompletedAt === null ? captured.asOfDay : cycleDay(source.timezone, captureCompletedAt),
    },
    capturedMemberships: job.capturedMemberships + page.page.length,
    captureCursor: page.isDone ? null : page.continueCursor,
    phase: page.isDone ? ("moving" as const) : ("capturing" as const),
    pendingCount: job.pendingCount + entries.length,
    status: page.isDone && job.pendingCount + entries.length === 0 ? ("completed" as const) : ("running" as const),
    revision: job.revision + 1,
  };
  requireTransferDocumentSize({ ...job, ...update });
  await ctx.db.patch(job._id, update);
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
    const pending = job.phase === "moving" ? await pendingEntries(ctx, job) : [];
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
export const buckets = query({
  args: { transferId: v.id("cycleTransfers"), paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const { job } = await requireJob(ctx, args.transferId);
    return ctx.db
      .query("cycleTransferBuckets")
      .withIndex("by_transfer", (q) => q.eq("transferId", job._id))
      .paginate(pageBudget(args.paginationOpts));
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
    const now = Date.now();
    const sourceUpdatedAt = Math.max(now, source.updatedAt + 1);
    const value = {
      projectId: source.projectId,
      sourceId: source._id,
      destinationId: destination._id,
      actorId: user._id,
      snapshot: {
        count: 0,
        numericEstimates: 0,
        unquantifiedEstimates: 0,
        captureStartedAt: now,
        captureCompletedAt: null,
        startDate: source.startDate,
        endDate: source.endDate,
        timezone: source.timezone,
        asOfDay: cycleDay(source.timezone, now),
      },
      phase: "capturing" as const,
      captureCursor: null,
      sourceUpdatedAt,
      capturedMemberships: 0,
      pendingCount: 0,
      movedCount: 0,
      skippedCount: 0,
      status: "running" as const,
      revision: 0,
    };
    requireTransferDocumentSize(value);
    const id = await ctx.db.insert("cycleTransfers", value);
    await ctx.db.patch(source._id, { updatedAt: sourceUpdatedAt });
    return id;
  },
});
export const step = mutation({
  args: { transferId: v.id("cycleTransfers"), expectedRevision: v.number() },
  handler: async (ctx, args) => {
    const { job, user, member } = await requireJob(ctx, args.transferId);
    revision(job, args.expectedRevision);
    if (job.status !== "running") throw new ConvexError("Transfer is not running.");
    const { cycle: source } = await requireCycle(ctx, job.sourceId, true);
    sourceAvailable(source);
    const { cycle: destination } = await requireCycle(ctx, job.destinationId, true);
    requireOpenCycle(destination);
    if (job.phase === "capturing") return capture(ctx, job, source, member.role);
    const batch = await pendingEntries(ctx, job);
    const checked = await Promise.all(batch.map((entry) => changed(ctx, job, entry)));
    if (checked.some((row) => row.reason))
      throw new ConvexError("Tasks changed after the snapshot. Review and explicitly skip them before continuing.");
    await Promise.all(
      batch.map(async (entry, index) => {
        const task = checked[index].task;
        if (!task) throw new ConvexError("Task not found.");
        await ctx.db.patch(entry.membershipId, { cycleId: destination._id });
        await ctx.db.patch(entry._id, { outcome: "moved" });
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
    await ctx.db.patch(job._id, {
      pendingCount: job.pendingCount - batch.length,
      movedCount: job.movedCount + batch.length,
      status: job.pendingCount === batch.length ? "completed" : "running",
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
    if (job.status !== "running" || job.phase !== "moving") throw new ConvexError("Transfer is not running.");
    if (
      !args.taskIds.length ||
      args.taskIds.length > TRANSFER_BATCH_SIZE ||
      new Set(args.taskIds).size !== args.taskIds.length
    )
      throw new ConvexError("Choose 1–20 distinct changed tasks.");
    await Promise.all(
      args.taskIds.map(async (taskId) => {
        const entry = await ctx.db
          .query("cycleTransferEntries")
          .withIndex("by_transfer_task", (q) => q.eq("transferId", job._id).eq("taskId", taskId))
          .unique();
        if (!entry || entry.outcome !== "pending") throw new ConvexError("Task is not pending in this transfer.");
        const result = await changed(ctx, job, entry);
        if (!result.reason) throw new ConvexError("Only changed tasks may be skipped.");
        await ctx.db.patch(entry._id, { outcome: "skipped", skipReason: result.reason });
      })
    );
    await ctx.db.patch(job._id, {
      pendingCount: job.pendingCount - args.taskIds.length,
      skippedCount: job.skippedCount + args.taskIds.length,
      status: job.pendingCount === args.taskIds.length ? "completed" : "running",
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
