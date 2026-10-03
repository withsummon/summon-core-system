import { ConvexError } from "convex/values";
import type { MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { MAX_TASK_SUBSCRIBERS } from "./schema";
// One bounded owner for self-subscription and mention-driven subscriptions.
export async function addSubscribers(ctx: MutationCtx, taskId: Id<"tasks">, userIds: Id<"users">[]) {
  const rows = await ctx.db
    .query("taskSubscriptions")
    .withIndex("by_task_user", (q) => q.eq("taskId", taskId))
    .take(MAX_TASK_SUBSCRIBERS + 1);
  const existing = new Set(rows.map((row) => row.userId));
  const additions = [...new Set(userIds)].filter((id) => !existing.has(id));
  if (rows.length + additions.length > MAX_TASK_SUBSCRIBERS)
    throw new ConvexError(`This task has reached its ${MAX_TASK_SUBSCRIBERS} subscriber limit.`);
  await Promise.all(additions.map((userId) => ctx.db.insert("taskSubscriptions", { taskId, userId })));
}
