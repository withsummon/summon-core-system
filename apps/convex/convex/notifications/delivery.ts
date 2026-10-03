import { addSubscribers } from "./subscriptions";
import { canMention } from "./mentions";
import type { Id } from "../_generated/dataModel";
import { discussionCanRead } from "../tasks/discussion_access";
import { ConvexError } from "convex/values";
import type { MutationCtx } from "../_generated/server";
import type { Doc } from "../_generated/dataModel";
/** One transaction owns the activity event and its recipient delivery. */
export async function recordTaskEvent(
  ctx: MutationCtx,
  event: Omit<Doc<"taskEvents">, "_id" | "_creationTime">,
  mentionedUserIds: Id<"users">[] = [],
  delivery: "subscribers" | "activity" = "subscribers"
) {
  const task = await ctx.db.get(event.taskId);
  if (!task || task.workspaceId !== event.workspaceId || task.projectId !== event.projectId)
    throw new ConvexError("Task event scope does not match its task.");
  const eventId = await ctx.db.insert("taskEvents", event);
  if (delivery === "activity") return eventId;
  await addSubscribers(ctx, task._id, mentionedUserIds);
  const mentions = new Set(mentionedUserIds);
  const subscriptions = await ctx.db
    .query("taskSubscriptions")
    .withIndex("by_task_user", (q) => q.eq("taskId", task._id))
    .take(100);
  const recipients = new Set(subscriptions.map((s) => s.userId));
  recipients.delete(event.actorId);
  await Promise.all(
    [...recipients].map(async (receiverId) => {
      if (!(await discussionCanRead(ctx, task, receiverId))) return;
      if (mentions.has(receiverId) && !(await canMention(ctx, task, receiverId))) return;
      await ctx.db.insert("notifications", {
        workspaceId: task.workspaceId,
        projectId: task.projectId,
        taskId: task._id,
        eventId,
        receiverId,
        isMention: mentions.has(receiverId),
        actorId: event.actorId,
        readAt: null,
        archivedAt: null,
        snoozedUntil: null,
      });
    })
  );
  return eventId;
}
