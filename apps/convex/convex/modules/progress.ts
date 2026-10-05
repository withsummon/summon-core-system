import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { query } from "../_generated/server";
import { currentProgress, progressPageBudget } from "../tasks/progress_totals";
import { requireModule } from "./access";
export const page = query({
  args: { moduleId: v.id("modules"), paginationOpts: paginationOptsValidator },
  handler: async (ctx, { moduleId, paginationOpts }) => {
    const { project, user, member } = await requireModule(ctx, moduleId, true);
    const result = await ctx.db
      .query("moduleTasks")
      .withIndex("by_module_task", (q) => q.eq("moduleId", moduleId))
      .paginate(progressPageBudget(paginationOpts));
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
