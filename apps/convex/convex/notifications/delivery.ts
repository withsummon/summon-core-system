import { ConvexError } from "convex/values";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { Id, Doc } from "../_generated/dataModel";
export async function recipientCanRead(ctx: QueryCtx, task: Doc<"tasks">, userId: Id<"users">) {
  const project = await ctx.db.get(task.projectId);
  if (!project || project.archived || project.workspaceId !== task.workspaceId) return false;
  const workspace = await ctx.db
    .query("workspaceMembers")
    .withIndex("by_workspace_user", (q) => q.eq("workspaceId", task.workspaceId).eq("userId", userId))
    .unique();
  const member = await ctx.db
    .query("projectMembers")
    .withIndex("by_project_user", (q) => q.eq("projectId", task.projectId).eq("userId", userId))
    .unique();
  return !!workspace?.active && !!member?.active;
}
/** One transaction owns the activity event and its recipient delivery. */
export async function recordTaskEvent(ctx: MutationCtx, event: Omit<Doc<"taskEvents">, "_id" | "_creationTime">) {
  const task = await ctx.db.get(event.taskId);
  if (!task || task.workspaceId !== event.workspaceId || task.projectId !== event.projectId)
    throw new ConvexError("Task event scope does not match its task.");
  const eventId = await ctx.db.insert("taskEvents", event);
  const subscriptions = await ctx.db
    .query("taskSubscriptions")
    .withIndex("by_task_user", (q) => q.eq("taskId", task._id))
    .take(100);
  const recipients = new Set(subscriptions.map((s) => s.userId));
  recipients.delete(event.actorId);
  await Promise.all(
    [...recipients].map(async (receiverId) => {
      if (!(await recipientCanRead(ctx, task, receiverId))) return;
      await ctx.db.insert("notifications", {
        workspaceId: task.workspaceId,
        projectId: task.projectId,
        taskId: task._id,
        eventId,
        receiverId,
        actorId: event.actorId,
        readAt: null,
        archivedAt: null,
        snoozedUntil: null,
      });
    })
  );
  return eventId;
}
