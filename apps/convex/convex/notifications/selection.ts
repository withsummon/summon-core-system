import { ConvexError } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { discussionCanRead } from "../tasks/discussion_access";
type Selection = Pick<Doc<"notificationReadBatches">, "view" | "mentionsOnly" | "categories" | "now">;
export function validateSelection(selection: Pick<Selection, "categories">) {
  const categories = selection.categories ?? [];
  if (categories.length > 3 || new Set(categories).size !== categories.length)
    throw new ConvexError("Choose at most three distinct notification categories.");
}
export async function selectedTask(
  ctx: QueryCtx,
  row: Doc<"notifications">,
  userId: Id<"users">,
  workspaceRole: string,
  selection: Selection
) {
  const snoozed = row.snoozedUntil !== null && row.snoozedUntil > selection.now;
  const visible =
    selection.view === "archived"
      ? row.archivedAt !== null
      : row.archivedAt === null && snoozed === (selection.view === "snoozed");
  if (!visible || (selection.mentionsOnly && !row.isMention)) return null;
  const task = await ctx.db.get(row.taskId);
  if (!task || !(await discussionCanRead(ctx, task, userId))) return null;
  const categories = selection.categories ?? [];
  if (!categories.length) return task;
  const created = task.createdBy === userId;
  const assigned = task.assigneeIds.includes(userId);
  if (categories.includes("assigned") && assigned) return task;
  if (categories.includes("created") && workspaceRole !== "guest" && created) return task;
  if (categories.includes("subscribed") && !created && !assigned) {
    const subscription = await ctx.db
      .query("taskSubscriptions")
      .withIndex("by_task_user", (q) => q.eq("taskId", task._id).eq("userId", userId))
      .unique();
    if (subscription) return task;
  }
  return null;
}
