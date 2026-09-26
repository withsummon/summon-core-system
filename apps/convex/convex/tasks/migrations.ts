import { v } from "convex/values";
import { internalMutation } from "../_generated/server";
import { initialProperties } from "./properties";

// Deployment transition only: page until isDone, then make schema properties required and remove this function.
export const backfillProperties = internalMutation({
  args: { cursor: v.union(v.string(), v.null()) },
  handler: async (ctx, args) => {
    const result = await ctx.db
      .query("tasks")
      .paginate({ cursor: args.cursor, numItems: 100, maximumRowsRead: 100, maximumBytesRead: 1048576 });
    await Promise.all(
      result.page.map(async (task) => {
        await ctx.db.patch(task._id, {
          priority: task.priority ?? initialProperties.priority,
          assigneeIds: task.assigneeIds ?? [],
          labelIds: task.labelIds ?? [],
          startDate: task.startDate ?? null,
          targetDate: task.targetDate ?? null,
          stateId: task.stateId ?? null,
          completedAt:
            task.completedAt === undefined ? (task.status === "done" ? task.updatedAt : null) : task.completedAt,
        });
      })
    );
    return { isDone: result.isDone, continueCursor: result.continueCursor, migrated: result.page.length };
  },
});
