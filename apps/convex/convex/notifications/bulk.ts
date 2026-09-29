import { ConvexError, v } from "convex/values";
import { mutation } from "../_generated/server";
import { requireWorkspace } from "../identity/access";
import { selectedTask, validateSelection } from "./selection";
import { selectionFields } from "./schema";
export const begin = mutation({
  args: { workspaceId: v.id("workspaces"), ...selectionFields },
  handler: async (ctx, args) => {
    const { user } = await requireWorkspace(ctx, args.workspaceId);
    validateSelection(args);
    const now = Date.now();
    return await ctx.db.insert("notificationReadBatches", {
      ...args,
      receiverId: user._id,
      cutoff: now,
      now,
      completed: false,
      cursor: null,
    });
  },
});
export const page = mutation({
  args: { batchId: v.id("notificationReadBatches") },
  handler: async (ctx, args) => {
    const batch = await ctx.db.get(args.batchId);
    if (!batch) throw new ConvexError("Read batch not found.");
    const { user, member } = await requireWorkspace(ctx, batch.workspaceId);
    if (batch.receiverId !== user._id) throw new ConvexError("Read batch not found.");
    if (batch.completed) return { isDone: true, changed: 0 };
    if (Date.now() - batch.now > 15 * 60_000) throw new ConvexError("Read batch expired. Start again.");
    const result = await ctx.db
      .query("notifications")
      .withIndex("by_receiver_workspace", (q) =>
        q.eq("receiverId", user._id).eq("workspaceId", batch.workspaceId).lt("_creationTime", batch.cutoff)
      )
      .order("desc")
      .paginate({ cursor: batch.cursor, numItems: 50, maximumRowsRead: 50, maximumBytesRead: 1_048_576 });
    const changes = await Promise.all(
      result.page.map(async (row) => {
        if (row.readAt !== null || !(await selectedTask(ctx, row, user._id, member.role, batch))) return 0;
        await ctx.db.patch(row._id, { readAt: Date.now() });
        return 1;
      })
    );
    const changed = changes.reduce<number>((total, value) => total + value, 0);
    await ctx.db.patch(batch._id, { cursor: result.continueCursor, completed: result.isDone });
    return { isDone: result.isDone, changed };
  },
});
export const cancel = mutation({
  args: { batchId: v.id("notificationReadBatches") },
  handler: async (ctx, args) => {
    const batch = await ctx.db.get(args.batchId);
    if (!batch) throw new ConvexError("Read batch not found.");
    const { user } = await requireWorkspace(ctx, batch.workspaceId);
    if (batch.receiverId !== user._id) throw new ConvexError("Read batch not found.");
    await ctx.db.patch(batch._id, { completed: true });
  },
});
