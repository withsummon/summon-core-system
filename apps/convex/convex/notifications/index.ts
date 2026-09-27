import { addSubscribers } from "./subscriptions";
import { paginationOptsValidator } from "convex/server";
import { ConvexError, v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { requireProject, requireWorkspace, requireUser } from "../identity/access";
import { requireTask } from "../tasks/access";
import { taskCanRead } from "../tasks/access";
export const subscribe = mutation({
  args: { taskId: v.id("tasks"), subscribed: v.boolean() },
  handler: async (ctx, args) => {
    const task = await requireTask(ctx, args.taskId, args.subscribed ? "active" : "read");
    const { user } = await requireProject(ctx, task.projectId);
    const previous = await ctx.db
      .query("taskSubscriptions")
      .withIndex("by_task_user", (q) => q.eq("taskId", task._id).eq("userId", user._id))
      .unique();
    if (!args.subscribed) {
      if (previous) await ctx.db.delete(previous._id);
      return;
    }
    if (previous) return;
    await addSubscribers(ctx, task._id, [user._id]);
  },
});
export const subscription = query({
  args: { taskId: v.id("tasks") },
  handler: async (ctx, args) => {
    const task = await requireTask(ctx, args.taskId, "read");
    const { user } = await requireProject(ctx, task.projectId);
    return !!(await ctx.db
      .query("taskSubscriptions")
      .withIndex("by_task_user", (q) => q.eq("taskId", task._id).eq("userId", user._id))
      .unique());
  },
});
export const list = query({
  args: {
    workspaceId: v.id("workspaces"),
    view: v.union(v.literal("inbox"), v.literal("archived"), v.literal("snoozed")),
    unreadOnly: v.boolean(),
    mentionsOnly: v.optional(v.boolean()),
    now: v.number(),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const { user } = await requireWorkspace(ctx, args.workspaceId);
    if (
      !Number.isSafeInteger(args.now) ||
      !Number.isSafeInteger(args.paginationOpts.numItems) ||
      args.paginationOpts.numItems < 1 ||
      args.paginationOpts.numItems > 100
    )
      throw new ConvexError("Invalid notification page.");
    const result = await ctx.db
      .query("notifications")
      .withIndex("by_receiver_workspace", (q) => q.eq("receiverId", user._id).eq("workspaceId", args.workspaceId))
      .order("desc")
      .paginate({ ...args.paginationOpts, maximumRowsRead: 100, maximumBytesRead: 1_048_576 });
    const rows = await Promise.all(
      result.page.map(async (row) => {
        const snoozed = row.snoozedUntil !== null && row.snoozedUntil > args.now;
        const visible =
          args.view === "archived"
            ? row.archivedAt !== null
            : row.archivedAt === null && (args.view === "snoozed" ? snoozed : !snoozed);
        if (!visible || (args.unreadOnly && row.readAt !== null) || (args.mentionsOnly && !row.isMention)) return null;
        const task = await ctx.db.get(row.taskId);
        if (!task || !(await taskCanRead(ctx, task, user._id))) return null;
        return {
          ...row,
          isMention: row.isMention ?? false,
          taskTitle: task.title,
          event: await ctx.db.get(row.eventId),
        };
      })
    );
    return { ...result, page: rows.filter((row) => row !== null) };
  },
});
export const update = mutation({
  args: {
    notificationId: v.id("notifications"),
    change: v.union(
      v.object({ kind: v.literal("read"), value: v.boolean() }),
      v.object({ kind: v.literal("archive"), value: v.boolean() }),
      v.object({ kind: v.literal("snooze"), until: v.union(v.number(), v.null()) })
    ),
  },
  handler: async (ctx, { notificationId, change }) => {
    const user = await requireUser(ctx);
    const row = await ctx.db.get(notificationId);
    if (!row || row.receiverId !== user._id) throw new ConvexError("Notification not found.");
    const task = await requireTask(ctx, row.taskId, "read");
    await requireProject(ctx, task.projectId);
    if (change.kind === "read") await ctx.db.patch(row._id, { readAt: change.value ? Date.now() : null });
    else if (change.kind === "archive") await ctx.db.patch(row._id, { archivedAt: change.value ? Date.now() : null });
    else {
      if (
        change.until !== null &&
        (!Number.isSafeInteger(change.until) ||
          change.until <= Date.now() ||
          change.until > Date.now() + 365 * 86400000)
      )
        throw new ConvexError("Choose a future snooze time within one year.");
      await ctx.db.patch(row._id, { snoozedUntil: change.until });
    }
  },
});

export const subscriptionAccess = query({
  args: { taskId: v.id("tasks") },
  handler: async (ctx, args) => {
    const task = await requireTask(ctx, args.taskId, "read");
    const { user } = await requireProject(ctx, task.projectId);
    const membership = await ctx.db
      .query("taskSubscriptions")
      .withIndex("by_task_user", (q) => q.eq("taskId", task._id).eq("userId", user._id))
      .unique();
    return {
      subscribed: membership !== null,
      canSubscribe: task.archivedAt == null,
      canUnsubscribe: membership !== null,
    };
  },
});
