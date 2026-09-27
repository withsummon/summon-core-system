import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { taskCanRead } from "../tasks/access";
export const category = v.union(v.literal("assigned"), v.literal("subscribed"), v.literal("created"));
export const selectionFields = {
  view: v.union(v.literal("inbox"), v.literal("archived"), v.literal("snoozed")),
  mentionsOnly: v.optional(v.boolean()),
  categories: v.optional(v.array(category)),
};
type Selection = {
  view: "inbox" | "archived" | "snoozed";
  mentionsOnly?: boolean;
  categories?: ("assigned" | "subscribed" | "created")[];
  now: number;
};
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
      : row.archivedAt === null && (selection.view === "snoozed" ? snoozed : !snoozed);
  if (!visible || (selection.mentionsOnly && !row.isMention)) return null;
  const task = await ctx.db.get(row.taskId);
  if (!task || !(await taskCanRead(ctx, task, userId))) return null;
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
