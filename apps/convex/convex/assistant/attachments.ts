import { v, ConvexError } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { query, mutation, internalQuery, internalMutation } from "../_generated/server";
import type { MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { requireConversation } from "./access";
import { authorizedContext } from "./context";
import { prepareAsset } from "../assets/index";
import { requireAsset, descriptor } from "../assets/access";
import { internal } from "../_generated/api";
import { pageBudget } from "../commercial/validation";
export const textTypes = { ".txt": "text/plain", ".md": "text/markdown", ".csv": "text/csv" } as const;
export const policy = query({
  args: {},
  handler: () => ({ types: textTypes, maxBytes: 10 * 1024 * 1024, maxAttachments: 5 }),
});
export const prepare = mutation({
  args: {
    conversationId: v.id("assistantConversations"),
    name: v.string(),
    contentType: v.string(),
    size: v.number(),
    sha256: v.string(),
  },
  handler: async (ctx, { conversationId, ...file }) => {
    const { conversation } = await requireConversation(ctx, conversationId, true);
    await authorizedContext(ctx, conversation.workspaceId, conversation.context);
    if (conversation.activeMessageId) throw new ConvexError("Wait for the current reply before attaching files.");
    if (
      !Object.entries(textTypes).some(
        ([extension, type]) => file.name.toLowerCase().endsWith(extension) && file.contentType === type
      )
    )
      throw new ConvexError("Choose TXT, Markdown, or CSV text files.");
    const pending = await ctx.db
      .query("assistantAttachments")
      .withIndex("by_pending", (q) => q.eq("conversationId", conversationId).eq("messageId", null).eq("deleted", false))
      .take(5);
    if (pending.length >= 5) throw new ConvexError("Attach up to five files per message. Remove an unused file first.");
    const ticket = await prepareAsset(ctx, {
      ...file,
      conversationId,
      workspaceId: conversation.workspaceId,
      projectId: null,
      documentId: null,
    });
    const attachmentId = await ctx.db.insert("assistantAttachments", {
      conversationId,
      assetId: ticket.assetId,
      messageId: null,
      status: "uploading",
      name: file.name,
      contentType: file.contentType,
      size: file.size,
      text: "",
      truncated: false,
      deleted: false,
      error: null,
    });
    return { ...ticket, attachmentId };
  },
});
export const pending = query({
  args: { conversationId: v.id("assistantConversations") },
  handler: async (ctx, { conversationId }) => {
    const { conversation } = await requireConversation(ctx, conversationId);
    await authorizedContext(ctx, conversation.workspaceId, conversation.context);
    const rows = await ctx.db
      .query("assistantAttachments")
      .withIndex("by_pending", (q) => q.eq("conversationId", conversationId).eq("messageId", null).eq("deleted", false))
      .take(5);
    return rows.map(({ text: _text, ...row }) => row);
  },
});
export const list = query({
  args: { conversationId: v.id("assistantConversations"), paginationOpts: paginationOptsValidator },
  handler: async (ctx, { conversationId, paginationOpts }) => {
    const { conversation } = await requireConversation(ctx, conversationId);
    await authorizedContext(ctx, conversation.workspaceId, conversation.context);
    const page = await ctx.db
      .query("assistantAttachments")
      .withIndex("by_conversation", (q) => q.eq("conversationId", conversationId))
      .order("desc")
      .paginate(pageBudget(paginationOpts));
    return { ...page, page: page.page.filter((row) => !row.deleted).map(({ text: _text, ...row }) => row) };
  },
});
export const extractionSource = internalQuery({
  args: { attachmentId: v.id("assistantAttachments") },
  handler: async (ctx, { attachmentId }) => {
    const attachment = await ctx.db.get(attachmentId);
    if (!attachment || attachment.deleted || attachment.messageId) throw new ConvexError("Attachment is unavailable.");
    await requireConversation(ctx, attachment.conversationId, true);
    return attachment;
  },
});
export const finish = internalMutation({
  args: { attachmentId: v.id("assistantAttachments"), text: v.string(), truncated: v.boolean() },
  handler: async (ctx, { attachmentId, text, truncated }) => {
    const attachment = await ctx.db.get(attachmentId);
    if (!attachment || attachment.deleted || attachment.messageId) throw new ConvexError("Attachment is unavailable.");
    await requireConversation(ctx, attachment.conversationId, true);
    await requireAsset(ctx, attachment.assetId, true);
    if (!text.trim() || text.length > 30000)
      throw new ConvexError("Attachment contains no readable text or exceeds its context limit.");
    await ctx.db.patch(attachmentId, { text, truncated, status: "ready", error: null });
    return attachmentId;
  },
});
export const fail = internalMutation({
  args: { attachmentId: v.id("assistantAttachments") },
  handler: async (ctx, { attachmentId }) => {
    const attachment = await ctx.db.get(attachmentId);
    if (!attachment || attachment.deleted || attachment.messageId || attachment.status === "ready") return;
    await requireConversation(ctx, attachment.conversationId, true);
    await ctx.db.patch(attachmentId, {
      status: "failed",
      error: "File could not be processed. Remove it and upload a valid text file.",
    });
  },
});
export const remove = mutation({
  args: { attachmentId: v.id("assistantAttachments") },
  handler: async (ctx, { attachmentId }) => {
    const attachment = await ctx.db.get(attachmentId);
    if (!attachment || attachment.deleted) throw new ConvexError("Attachment is unavailable.");
    const { conversation } = await requireConversation(ctx, attachment.conversationId, true);
    await authorizedContext(ctx, conversation.workspaceId, conversation.context);
    if (attachment.messageId) throw new ConvexError("Files already attached to a message cannot be removed.");
    await ctx.db.patch(attachmentId, { deleted: true, text: "" });
    await ctx.db.patch(attachment.assetId, { status: "deleted", expiresAt: Date.now() });
  },
});
export const download = query({
  args: { conversationId: v.id("assistantConversations"), attachmentId: v.string() },
  handler: async (ctx, { conversationId, attachmentId: raw }) => {
    const id = ctx.db.normalizeId("assistantAttachments", raw);
    const attachment = id ? await ctx.db.get(id) : null;
    if (
      !attachment ||
      attachment.deleted ||
      attachment.conversationId !== conversationId ||
      attachment.status !== "ready"
    )
      throw new ConvexError("Attachment is unavailable.");
    return descriptor((await requireAsset(ctx, attachment.assetId)).asset);
  },
});
export async function selectedAttachments(
  ctx: MutationCtx,
  conversationId: Id<"assistantConversations">,
  ids: Id<"assistantAttachments">[]
) {
  if (ids.length > 5 || new Set(ids).size !== ids.length)
    throw new ConvexError("Choose up to five distinct attachments.");
  return Promise.all(
    ids.map(async (id) => {
      const row = await ctx.db.get(id);
      if (!row || row.deleted || row.conversationId !== conversationId || row.messageId || row.status !== "ready")
        throw new ConvexError("Choose ready, unbound attachments from this conversation.");
      await requireAsset(ctx, row.assetId);
      return row;
    })
  );
}

export const purgeConversation = internalMutation({
  args: { conversationId: v.id("assistantConversations"), cursor: v.union(v.string(), v.null()) },
  handler: async (ctx, { conversationId, cursor }) => {
    const conversation = await ctx.db.get(conversationId);
    if (!conversation?.deleted) return;
    const page = await ctx.db
      .query("assistantAttachments")
      .withIndex("by_conversation", (q) => q.eq("conversationId", conversationId))
      .paginate({ numItems: 100, cursor });
    await Promise.all(
      page.page.map(async (file) => {
        await ctx.db.patch(file._id, { deleted: true, text: "" });
        await ctx.db.patch(file.assetId, { status: "deleted", expiresAt: Date.now() });
      })
    );
    if (!page.isDone)
      await ctx.scheduler.runAfter(0, internal.assistant.attachments.purgeConversation, {
        conversationId,
        cursor: page.continueCursor,
      });
  },
});
