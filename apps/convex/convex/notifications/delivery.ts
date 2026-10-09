import { addSubscribers } from "./subscriptions";
import type { Id } from "../_generated/dataModel";
import { discussionCanRead } from "../tasks/discussion_access";
import { ConvexError, v } from "convex/values";
import type { MutationCtx } from "../_generated/server";
import type { Doc } from "../_generated/dataModel";
import { defaultEmailPreferenceSettings } from "./schema";
import { taskIsActive } from "../tasks/access";
import { internalMutation } from "../_generated/server";
import { internal } from "../_generated/api";
/** The event and its durable native delivery schedule commit together. */
export async function recordTaskEvent(
  ctx: MutationCtx,
  event: Omit<Doc<"taskEvents">, "_id" | "_creationTime">,
  mentionedUserIds: Id<"users">[] = [],
  delivery: "subscribers" | "activity" = "subscribers",
  commentBefore: string | null = null
): Promise<Id<"taskEvents">> {
  const task = await ctx.db.get(event.taskId);
  if (!task || task.workspaceId !== event.workspaceId || task.projectId !== event.projectId)
    throw new ConvexError("Task event scope does not match its task.");
  const eventId = await ctx.db.insert("taskEvents", event);
  if (delivery === "activity") return eventId;
  const addedAssignees =
    event.kind === "created"
      ? task.assigneeIds
      : (event.changes ?? []).flatMap((change) =>
          change.field === "assignees" ? change.added.map((member) => member.id) : []
        );
  const comment = event.commentId && event.kind !== "comment_deleted" ? await ctx.db.get(event.commentId) : null;
  const deliveryId = await ctx.db.insert("notificationEventDeliveries", {
    eventId,
    subscribers: [
      ...new Set([event.actorId, ...addedAssignees, ...(comment?.mentionedUserIds ?? []), ...mentionedUserIds]),
    ],
    mentions: mentionedUserIds,
    commentBefore,
    commentAfter: comment?.text ?? null,
    cursor: null,
    completed: false,
  });
  await ctx.scheduler.runAfter(0, internal.notifications.delivery.deliver, { deliveryId, cursor: null });
  return eventId;
}

export const deliver = internalMutation({
  args: { deliveryId: v.id("notificationEventDeliveries"), cursor: v.union(v.string(), v.null()) },
  handler: async (ctx, args): Promise<void> => {
    const delivery = await ctx.db.get(args.deliveryId);
    if (!delivery || delivery.completed || delivery.cursor !== args.cursor) return;
    const event = await ctx.db.get(delivery.eventId);
    if (!event) throw new ConvexError("Task event delivery lost its source.");
    const task = await ctx.db.get(event.taskId);
    if (task) {
      if (args.cursor === null) {
        const eligible = await Promise.all(
          delivery.subscribers.map(async (id) => ((await discussionCanRead(ctx, task, id)) ? id : null))
        );
        await addSubscribers(
          ctx,
          task._id,
          eligible.filter((id) => id !== null)
        );
      }
      const page = await ctx.db
        .query("taskSubscriptions")
        .withIndex("by_task_user", (q) => q.eq("taskId", task._id))
        .paginate({ cursor: args.cursor, numItems: 20, maximumRowsRead: 20, maximumBytesRead: 1_048_576 });
      const mentions = new Set(delivery.mentions);
      await Promise.all(
        page.page.map(async ({ userId: receiverId }) => {
          if (receiverId === event.actorId || !(await discussionCanRead(ctx, task, receiverId))) return;
          const mention = mentions.has(receiverId);
          await ctx.db.insert("notifications", {
            workspaceId: task.workspaceId,
            projectId: task.projectId,
            taskId: task._id,
            eventId: event._id,
            receiverId,
            isMention: mention,
            actorId: event.actorId,
            readAt: null,
            archivedAt: null,
            snoozedUntil: null,
          });
          if (taskIsActive(task)) await queueEmail(ctx, task, event, delivery, receiverId, mention);
        })
      );
      await ctx.db.patch(delivery._id, { cursor: page.continueCursor, completed: page.isDone });
      if (!page.isDone) {
        await ctx.scheduler.runAfter(0, internal.notifications.delivery.deliver, {
          deliveryId: delivery._id,
          cursor: page.continueCursor,
        });
        return;
      }
    } else await ctx.db.patch(delivery._id, { completed: true });
    if (
      !(await ctx.db
        .query("notificationEmailLogs")
        .withIndex("by_delivery", (q) => q.eq("deliveryId", delivery._id))
        .first())
    )
      await ctx.db.delete(delivery._id);
  },
});

// Current async preferences select canonical fields; content remains once per event.
async function queueEmail(
  ctx: MutationCtx,
  task: Doc<"tasks">,
  event: Omit<Doc<"taskEvents">, "_id" | "_creationTime">,
  delivery: Doc<"notificationEventDeliveries">,
  receiverId: Id<"users">,
  mention: boolean
) {
  if (["reaction_changed", "vote_changed"].includes(event.kind)) return;
  const preference = await ctx.db
    .query("notificationPreferences")
    .withIndex("by_user", (q) => q.eq("userId", receiverId))
    .unique();
  const settings = preference?.settings ?? defaultEmailPreferenceSettings;
  const changes = mention
    ? []
    : (event.changes ?? []).filter((change) => {
        if (change.field === "vote" || change.field === "cycle" || change.field === "modules") return false;
        return change.field === "state"
          ? settings.stateChange ||
              (change.after.status === "done" && settings.issueCompleted) ||
              settings.propertyChange
          : settings.propertyChange;
      });
  const sendComment =
    (delivery.commentBefore !== null || delivery.commentAfter !== null) &&
    (mention ? settings.mention : settings.comment || settings.propertyChange);
  const sendCreated = !mention && event.kind === "created" && settings.propertyChange;
  if (!sendComment && !sendCreated && changes.length === 0) return;
  const batch = await ctx.db
    .query("notificationEmailBatches")
    .withIndex("by_receiver_task_processed", (q) =>
      q.eq("receiverId", receiverId).eq("taskId", task._id).eq("processedAt", null)
    )
    .unique();
  const batchId =
    batch?._id ??
    (await ctx.db.insert("notificationEmailBatches", {
      taskId: task._id,
      receiverId,
      processedAt: null,
      providerId: null,
      acceptedAt: null,
      failure: null,
    }));
  await ctx.db.insert("notificationEmailLogs", {
    batchId,
    deliveryId: delivery._id,
    fields: changes.map((change) => change.field),
    mention,
    comment: sendComment,
  });
}
