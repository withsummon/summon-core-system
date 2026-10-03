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
  args: { transferId: v.id("cycleTransfers") },
  handler: async (ctx, { transferId }) => {
    const job = await ctx.db.get(transferId);
    if (!job) throw new ConvexError("Transfer not found.");
    await requireCycle(ctx, job.sourceId, true);
    return job.snapshot.completionCurve
      ? { status: "available" as const, curve: job.snapshot.completionCurve }
      : { status: "unavailable" as const, curve: null };
  },
});
