import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { query } from "../_generated/server";
import { currentProgress, progressPageBudget } from "../tasks/progress_totals";
import { requireCycle } from "./access";
export const page = query({
  args: { cycleId: v.id("cycles"), paginationOpts: paginationOptsValidator },
  handler: async (ctx, { cycleId, paginationOpts }) => {
    const { project, user, member } = await requireCycle(ctx, cycleId);
    const result = await ctx.db
      .query("cycleTasks")
      .withIndex("by_cycle", (q) => q.eq("cycleId", cycleId))
      .paginate(progressPageBudget(paginationOpts));
    // One contribution even for an empty authorized page preserves sparse cursors.
    return {
      ...result,
      page: [
        await currentProgress(
          ctx,
          result.page.map((row) => row.taskId),
          project,
          user._id,
          member.role
        ),
      ],
    };
  },
});
