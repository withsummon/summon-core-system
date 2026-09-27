import { paginationOptsValidator } from "convex/server";
import { ConvexError, v } from "convex/values";
import { query } from "../_generated/server";
import { taskCanRead, taskIsActive } from "../tasks/access";
import { requireCycle } from "./access";
import { progressTotals } from "./transfer_snapshot";

export const page = query({
  args: { cycleId: v.id("cycles"), paginationOpts: paginationOptsValidator },
  handler: async (ctx, { cycleId, paginationOpts }) => {
    const { cycle, user } = await requireCycle(ctx, cycleId);
    if (!Number.isSafeInteger(paginationOpts.numItems) || paginationOpts.numItems < 1 || paginationOpts.numItems > 20)
      throw new ConvexError("Request 1–20 cycle memberships per page.");
    const result = await ctx.db
      .query("cycleTasks")
      .withIndex("by_cycle", (q) => q.eq("cycleId", cycleId))
      .paginate({
        ...paginationOpts,
        maximumRowsRead: 20,
        maximumBytesRead: 1_048_576,
      });
    const candidates = await Promise.all(
      result.page.map(async (row) => {
        const task = await ctx.db.get(row.taskId);
        return task &&
          task.projectId === cycle.projectId &&
          task.workspaceId === cycle.workspaceId &&
          taskIsActive(task) &&
          (await taskCanRead(ctx, task, user._id))
          ? task
          : null;
      })
    );
    const contribution = await progressTotals(
      ctx,
      candidates.filter((task) => task !== null)
    );
    // One contribution even for an empty authorized page preserves sparse cursors.
    return { ...result, page: [contribution] };
  },
});
