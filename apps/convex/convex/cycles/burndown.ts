import { paginationOptsValidator } from "convex/server";
import { ConvexError, v } from "convex/values";
import { query } from "../_generated/server";
import { taskCanRead, taskIsActive } from "../tasks/access";
import { progressPageBudget } from "../tasks/progress_totals";
import { requireCycle } from "./access";
import { validateCycleClock } from "./dates";
import { curve } from "./completion_curve";
export const page = query({
  args: { cycleId: v.id("cycles"), now: v.number(), paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    validateCycleClock(args.now);
    const { cycle, project, user } = await requireCycle(ctx, args.cycleId);
    const result = await ctx.db
      .query("cycleTasks")
      .withIndex("by_cycle", (q) => q.eq("cycleId", cycle._id))
      .paginate(progressPageBudget(args.paginationOpts));
    const candidates = await Promise.all(
      result.page.map(async (row) => {
        const task = await ctx.db.get(row.taskId);
        return task &&
          task.projectId === project._id &&
          task.workspaceId === project.workspaceId &&
          taskIsActive(task) &&
          (await taskCanRead(ctx, task, user._id))
          ? task
          : null;
      })
    );
    return {
      ...result,
      page: [
        await curve(
          ctx,
          cycle,
          candidates.filter((task) => task !== null),
          args.now
        ),
      ],
    };
  },
});

export const frozen = query({
  args: { transferId: v.id("cycleTransfers"), paginationOpts: paginationOptsValidator },
  handler: async (ctx, { transferId, paginationOpts }) => {
    const job = await ctx.db.get(transferId);
    if (!job) throw new ConvexError("Transfer not found.");
    await requireCycle(ctx, job.sourceId, true);
    const result = await ctx.db
      .query("cycleTransferBuckets")
      .withIndex("by_transfer_kind_id", (q) => q.eq("transferId", transferId).eq("kind", "completion"))
      .paginate(progressPageBudget(paginationOpts));
    return {
      ...result,
      page: [
        {
          status: job.snapshot.captureCompletedAt === null ? ("capturing" as const) : ("available" as const),
          captureStartedAt: job.snapshot.captureStartedAt,
          captureCompletedAt: job.snapshot.captureCompletedAt,
          curve: {
            startDate: job.snapshot.startDate,
            endDate: job.snapshot.endDate,
            timezone: job.snapshot.timezone,
            asOfDay: job.snapshot.asOfDay,
            count: job.snapshot.count,
            points: job.snapshot.numericEstimates,
            unquantified: job.snapshot.unquantifiedEstimates,
            completed: result.page.map((row) => ({
              day: row.name,
              count: row.count,
              points: row.numericEstimates,
              unquantified: row.unquantifiedEstimates,
            })),
          },
        },
      ],
    };
  },
});
