import { stream } from "convex-helpers/server/stream";
import schema from "../schema";
import { conversationResult } from "../mcp/invocations";
import { ConvexError, v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { internal } from "../_generated/api";
import { mutation, query } from "../_generated/server";
import { requireWorkspace } from "../identity/access";
import { pageBudget, text } from "../commercial/validation";
import { contextFields } from "./schema";
import { authorizedContext } from "./context";
import { requireConversation } from "./access";
export const save = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    conversationId: v.optional(v.id("assistantConversations")),
    title: v.string(),
    context: v.object(contextFields),
  },
  handler: async (ctx, args) => {
    const { user } = await requireWorkspace(ctx, args.workspaceId, true);
    const existing = args.conversationId
      ? (await requireConversation(ctx, args.conversationId, true)).conversation
      : null;
    if (existing && existing.workspaceId !== args.workspaceId)
      throw new ConvexError("Conversation belongs to another workspace.");
    if (
      existing &&
      (existing.context.projectId !== args.context.projectId ||
        existing.context.clientId !== args.context.clientId ||
        existing.context.meetingId !== args.context.meetingId ||
        existing.context.documentIds.length !== args.context.documentIds.length ||
        existing.context.documentIds.some((id, index) => id !== args.context.documentIds[index]))
    ) {
      const message = await ctx.db
        .query("assistantMessages")
        .withIndex("by_conversation", (q) => q.eq("conversationId", existing._id))
        .first();
      if (message) throw new ConvexError("Start a new conversation to change context after sending a message.");
    }
    if (existing?.activeMessageId) throw new ConvexError("Cancel the active reply before changing its context.");
    const title = text(args.title, "Conversation title", 255, true);
    await authorizedContext(ctx, args.workspaceId, args.context);
    if (args.conversationId) {
      await ctx.db.patch(args.conversationId, { title, context: args.context });
      return args.conversationId;
    }
    return ctx.db.insert("assistantConversations", {
      workspaceId: args.workspaceId,
      ownerId: user._id,
      title,
      context: args.context,
      lastActivityAt: Date.now(),
      activeMessageId: null,
      deleted: false,
    });
  },
});
export const list = query({
  args: { workspaceId: v.id("workspaces"), paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const { user } = await requireWorkspace(ctx, args.workspaceId);
    return ctx.db
      .query("assistantConversations")
      .withIndex("by_workspace_owner_activity", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("ownerId", user._id).eq("deleted", false)
      )
      .order("desc")
      .paginate(pageBudget(args.paginationOpts));
  },
});
export const get = query({
  args: { conversationId: v.id("assistantConversations") },
  handler: async (ctx, args) => (await requireConversation(ctx, args.conversationId)).conversation,
});
export const messages = query({
  args: { conversationId: v.id("assistantConversations"), paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const { conversation, user } = await requireConversation(ctx, args.conversationId);
    await authorizedContext(ctx, conversation.workspaceId, conversation.context);
    return stream(ctx.db, schema)
      .query("assistantMessages")
      .withIndex("by_conversation", (q) => q.eq("conversationId", args.conversationId))
      .order("desc")
      .map(async (message) => {
        if (message.mcpInvocationId) {
          const result = await conversationResult(ctx, message.mcpInvocationId, conversation._id, user._id);
          if (result) message.content = result;
        }
        return message;
      })
      .paginate(pageBudget(args.paginationOpts));
  },
});
export const remove = mutation({
  args: { conversationId: v.id("assistantConversations") },
  handler: async (ctx, args) => {
    const { conversation } = await requireConversation(ctx, args.conversationId, true);
    if (conversation.activeMessageId) await ctx.db.patch(conversation.activeMessageId, { status: "cancelled" });
    await ctx.db.patch(conversation._id, { deleted: true, activeMessageId: null });
    await ctx.scheduler.runAfter(0, internal.assistant.attachments.purgeConversation, {
      conversationId: conversation._id,
      cursor: null,
    });
  },
});
export const cancelReply = mutation({
  args: { conversationId: v.id("assistantConversations") },
  handler: async (ctx, args) => {
    const { conversation } = await requireConversation(ctx, args.conversationId, true);
    if (conversation.activeMessageId) await ctx.db.patch(conversation.activeMessageId, { status: "cancelled" });
    await ctx.db.patch(conversation._id, { activeMessageId: null });
  },
});

export const resolve = query({
  args: { conversationId: v.string() },
  handler: async (ctx, args) => {
    const conversationId = ctx.db.normalizeId("assistantConversations", args.conversationId);
    if (!conversationId) throw new ConvexError("Conversation not found.");
    return (await requireConversation(ctx, conversationId)).conversation;
  },
});
