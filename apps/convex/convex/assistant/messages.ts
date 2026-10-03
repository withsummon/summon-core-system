import { v, ConvexError } from "convex/values";
import { internalMutation } from "../_generated/server";
import { requireConversation } from "./access";
import { selectedAttachments } from "./attachments";
import { conversationResult } from "../mcp/invocations";
import { documentProposal } from "./actions";
import { authorizedContext } from "./context";
export const begin = internalMutation({
  args: {
    conversationId: v.string(),
    requestId: v.string(),
    content: v.string(),
    attachmentIds: v.array(v.string()),
    provider: v.string(),
    model: v.string(),
  },
  handler: async (ctx, args) => {
    const conversationId = ctx.db.normalizeId("assistantConversations", args.conversationId);
    if (!conversationId) throw new ConvexError("Conversation not found.");
    const { conversation } = await requireConversation(ctx, conversationId, true);
    if (!args.content.trim() || args.content.length > 20000 || !/^[a-zA-Z0-9_-]{8,100}$/.test(args.requestId))
      throw new ConvexError("Invalid message or request identifier.");
    const attachmentIds = args.attachmentIds.map((id) => {
      const normalized = ctx.db.normalizeId("assistantAttachments", id);
      if (!normalized) throw new ConvexError("Attachment not found.");
      return normalized;
    });
    const previous = await ctx.db
      .query("assistantMessages")
      .withIndex("by_request_role", (q) =>
        q.eq("conversationId", conversationId).eq("requestId", args.requestId).eq("role", "user")
      )
      .unique();
    if (previous) {
      await authorizedContext(ctx, conversation.workspaceId, previous.context);
      const acceptedIds = previous.citations
        .filter((citation) => citation.kind === "attachment")
        .map((citation) => citation.id);
      if (previous.content !== args.content || JSON.stringify(acceptedIds) !== JSON.stringify(attachmentIds))
        throw new ConvexError("Request identifier was already used for different message inputs.");
      const reply = await ctx.db
        .query("assistantMessages")
        .withIndex("by_request_role", (q) =>
          q.eq("conversationId", conversationId).eq("requestId", args.requestId).eq("role", "assistant")
        )
        .unique();
      if (!reply) throw new ConvexError("Accepted reply is unavailable.");
      return { messageId: reply._id, alreadyAccepted: true, context: "", messages: [] };
    }
    const selected = await selectedAttachments(ctx, conversationId, attachmentIds);
    const historyFiles = await ctx.db
      .query("assistantAttachments")
      .withIndex("by_conversation", (q) => q.eq("conversationId", conversationId))
      .order("desc")
      .take(101);
    const availableSources = [
      ...selected,
      ...historyFiles.filter((file) => file.messageId && !file.deleted && file.status === "ready"),
    ];
    const sources = availableSources.slice(0, 100);
    const context = await authorizedContext(
      ctx,
      conversation.workspaceId,
      conversation.context,
      sources.map((file) => ({
        text: `[Attached file: ${file.name}]\n${file.text}`,
        citation: { kind: "attachment" as const, id: file._id, label: file.name },
      }))
    );
    context.truncated ||=
      historyFiles.length > 100 || availableSources.length > 100 || sources.some((file) => file.truncated);
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
    const userMessageId = await ctx.db.insert("assistantMessages", {
      ...shared,
      role: "user",
      status: "completed",
      content: args.content,
      citations: selected.map((file) => ({ kind: "attachment" as const, id: file._id, label: file.name })),
    });
    await Promise.all(selected.map((file) => ctx.db.patch(file._id, { messageId: userMessageId })));
    const proposal = await documentProposal(
      ctx,
      conversation,
      args.content,
      sources.map((file) => file._id)
    );
    const messageId = await ctx.db.insert("assistantMessages", {
      ...shared,
      role: "assistant",
      status: proposal ? "completed" : "streaming",
      content: proposal ?? "",
      provider: proposal ? "summon-document-preview" : shared.provider,
    });
    await ctx.db.patch(conversationId, { activeMessageId: proposal ? null : messageId, lastActivityAt: Date.now() });
    const authorizedHistory = await Promise.all(
      history.map(async (message) => {
        if (message.mcpInvocationId) {
          const result = await conversationResult(ctx, message.mcpInvocationId, conversationId, conversation.ownerId);
          if (result) message.content = result;
        }
        return message;
      })
    );
    let remaining = 60000;
    const messages = authorizedHistory
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
      alreadyAccepted: Boolean(proposal),
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
    const message = await ctx.db.get(messageId);
    if (!message || message.status !== "streaming") return;
    const conversation = await ctx.db.get(message.conversationId);
    if (!conversation || conversation.activeMessageId !== messageId) return;
    await ctx.db.patch(messageId, {
      status: "failed",
      error: "Reply could not be completed. Check access and provider configuration before retrying.",
    });
    await ctx.db.patch(conversation._id, { activeMessageId: null });
  },
});
