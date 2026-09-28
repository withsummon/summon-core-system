import { ConvexError } from "convex/values";
import type { MutationCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { MAX_TASK_SUBSCRIBERS } from "./schema";
import { syncSubscriptionProfile } from "../tasks/profile";
// One bounded owner for self-subscription and mention-driven subscriptions.
/* eslint-disable no-await-in-loop -- Serial native writes preserve Convex's IO budget under atomic bulk writes. */
export async function addSubscribers(ctx: MutationCtx, taskId: Id<"tasks">, userIds: Id<"users">[]) {
  const rows = await ctx.db
    .query("taskSubscriptions")
    .withIndex("by_task_user", (q) => q.eq("taskId", taskId))
    .take(MAX_TASK_SUBSCRIBERS + 1);
  const existing = new Set(rows.map((row) => row.userId));
  const additions = [...new Set(userIds)].filter((id) => !existing.has(id));
  if (rows.length + additions.length > MAX_TASK_SUBSCRIBERS)
    throw new ConvexError(`This task has reached its ${MAX_TASK_SUBSCRIBERS} subscriber limit.`);
  if (!additions.length) return;
  const task = await ctx.db.get(taskId);
  if (!task) throw new ConvexError("Task not found.");
  for (const userId of additions) {
    await ctx.db.insert("taskSubscriptions", { taskId, userId });
    await syncSubscriptionProfile(ctx, task, userId, true);
  }
}
/* eslint-enable no-await-in-loop */

export async function removeSubscriber(ctx: MutationCtx, task: Doc<"tasks">, userId: Id<"users">) {
  const previous = await ctx.db
    .query("taskSubscriptions")
    .withIndex("by_task_user", (q) => q.eq("taskId", task._id).eq("userId", userId))
    .unique();
  if (!previous) return;
  await syncSubscriptionProfile(ctx, task, userId, false);
  await ctx.db.delete(previous._id);
}
