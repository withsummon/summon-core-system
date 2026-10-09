import type { MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
// Indexed uniqueness owns subscriptions; recipient fanout is paginated separately.
export async function addSubscribers(ctx: MutationCtx, taskId: Id<"tasks">, userIds: Id<"users">[]) {
  await Promise.all(
    [...new Set(userIds)].map(async (userId) => {
      const existing = await ctx.db
        .query("taskSubscriptions")
        .withIndex("by_task_user", (q) => q.eq("taskId", taskId).eq("userId", userId))
        .unique();
      if (!existing) await ctx.db.insert("taskSubscriptions", { taskId, userId });
    })
  );
}
