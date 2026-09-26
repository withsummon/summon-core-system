import { v, ConvexError } from "convex/values";
import { internalMutation } from "../_generated/server";
import { requireUser } from "../identity/access";
import { requireConversation } from "./access";
import { authorizedContext } from "./context";
export const begin = internalMutation({
  args: {
    conversationId: v.string(),
    requestId: v.string(),
    content: v.string(),
    provider: v.string(),
    model: v.string(),
  },
  handler: async (ctx, args) => {
    const conversationId = ctx.db.normalizeId("assistantConversations", args.conversationId);
    if (!conversationId) throw new ConvexError("Conversation not found.");
    const { conversation } = await requireConversation(ctx, conversationId, true);
    if (!args.content.trim() || args.content.length > 20000 || !/^[a-zA-Z0-9_-]{8,100}$/.test(args.requestId))
      throw new ConvexError("Invalid message or request identifier.");
    const context = await authorizedContext(ctx, conversation.workspaceId, conversation.context);
    const previous = await ctx.db
      .query("assistantMessages")
      .withIndex("by_request_role", (q) =>
        q.eq("conversationId", conversationId).eq("requestId", args.requestId).eq("role", "user")
      )
      .unique();
    if (previous) throw new ConvexError("This request was already accepted. Read the conversation for its result.");
    if (conversation.activeMessageId) throw new ConvexError("A reply is already in progress.");
    const history = await ctx.db
      .query("assistantMessages")
      .withIndex("by_conversation", (q) => q.eq("conversationId", conversationId))
      .order("desc")
      .take(40);
    const shared = {
      workspaceId: conversation.workspaceId,
      conversationId,
      requestId: args.requestId,
      citations: context.citations,
      context: conversation.context,
      contextTruncated: context.truncated,
      provider: args.provider,
      model: args.model,
      inputTokens: null,
      outputTokens: null,
      error: null,
    };
    await ctx.db.insert("assistantMessages", { ...shared, role: "user", status: "completed", content: args.content });
    const messageId = await ctx.db.insert("assistantMessages", {
      ...shared,
      role: "assistant",
      status: "streaming",
      content: "",
    });
    await ctx.db.patch(conversationId, { activeMessageId: messageId, lastActivityAt: Date.now() });
    let remaining = 60000;
    const messages = history
      .filter((m) => m.status === "completed")
      .filter((m) => {
        remaining -= m.content.length;
        return remaining >= 0;
      })
      // Consumers typecheck generated APIs with ES2022; this filtered array is locally owned.
      // oxlint-disable-next-line unicorn/no-array-reverse
      .reverse()
      .map((m) => ({ role: m.role, content: m.content }));
    return {
      messageId,
      context: context.text,
      messages: [...messages, { role: "user" as const, content: args.content }],
    };
  },
});
export const publish = internalMutation({
  args: { messageId: v.id("assistantMessages"), chunk: v.string(), complete: v.boolean() },
  handler: async (ctx, args) => {
    const message = await ctx.db.get(args.messageId);
    if (!message) throw new ConvexError("Message not found.");
    const { conversation } = await requireConversation(ctx, message.conversationId, true);
    await authorizedContext(ctx, message.workspaceId, message.context);
    if (message.status !== "streaming" || conversation.activeMessageId !== message._id)
      throw new ConvexError("Reply is no longer active.");
    if (message.content.length + args.chunk.length > 100000) throw new ConvexError("Reply exceeded its size limit.");
    await ctx.db.patch(message._id, {
      content: message.content + args.chunk,
      status: args.complete ? "completed" : "streaming",
    });
    if (args.complete) await ctx.db.patch(conversation._id, { activeMessageId: null, lastActivityAt: Date.now() });
  },
});
export const fail = internalMutation({
  args: { messageId: v.id("assistantMessages") },
  handler: async (ctx, { messageId }) => {
    const user = await requireUser(ctx);
    const message = await ctx.db.get(messageId);
    if (!message) return;
    const conversation = await ctx.db.get(message.conversationId);
    if (!conversation || conversation.ownerId !== user._id) throw new ConvexError("Conversation access denied.");
    if (message.status !== "streaming") return;
    await ctx.db.patch(messageId, {
      status: "failed",
      error: "Reply could not be completed. Check access and provider configuration before retrying.",
    });
    if (conversation.activeMessageId === messageId) await ctx.db.patch(conversation._id, { activeMessageId: null });
  },
});
