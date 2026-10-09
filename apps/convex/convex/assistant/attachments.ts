import { v, ConvexError } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { query, mutation, internalQuery, internalMutation } from "../_generated/server";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { requireConversation, requireConversationForUser } from "./access";
import { authorizedContext, authorizedContextForUser } from "./context";
import { prepareAsset } from "../assets/index";
import { requireAsset, descriptor } from "../assets/access";
import { internal } from "../_generated/api";
import {
  assetTypesByExtension,
  assistantAudioTypesByExtension,
  meetingRecordingMaxBytes,
  assetSizeLimit,
  isAudioAsset,
} from "../assets/content";
import { pageBudget } from "../commercial/validation";
import { requireAccountUser } from "../identity/session";
import { TRANSCRIPTION_WATCHDOG_DELAY_MS } from "../meetings/transcription/schema";
export const documentTypes = Object.fromEntries(
  Object.entries(assetTypesByExtension).filter(([extension]) =>
    [".txt", ".md", ".csv", ".pdf", ".docx", ".xlsx", ".pptx"].includes(extension)
  )
);
const attachmentTypes = { ...documentTypes, ...assistantAudioTypesByExtension };
export const policy = query({
  args: {},
  handler: () => ({
    files: Object.entries(attachmentTypes).map(([extension, contentType]) => ({
      extension,
      contentType,
      maxBytes: contentType.startsWith("audio/") ? meetingRecordingMaxBytes : assetSizeLimit(contentType),
    })),
    maxAttachments: 5,
  }),
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
      !Object.entries(attachmentTypes).some(
        ([extension, type]) => file.name.toLowerCase().endsWith(extension) && file.contentType === type
      )
    )
      throw new ConvexError("Choose PDF, Office, TXT, Markdown, CSV, MP3, or M4A files.");
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
      .withIndex("by_conversation_deleted", (q) => q.eq("conversationId", conversationId).eq("deleted", false))
      .order("desc")
      .paginate(pageBudget(paginationOpts));
    return { ...page, page: page.page.map(({ text: _text, ...row }) => row) };
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
      error: "File could not be processed. Remove it and upload a valid file.",
    });
  },
});
export const remove = mutation({
  args: { attachmentId: v.id("assistantAttachments") },
  handler: async (ctx, { attachmentId }) => {
    const attachment = await ctx.db.get(attachmentId);
    if (!attachment || attachment.deleted) throw new ConvexError("Attachment is unavailable.");
    // The conversation owner may remove an unbound upload after its context access is revoked.
    await requireConversation(ctx, attachment.conversationId, true);
    if (attachment.messageId) throw new ConvexError("Files already attached to a message cannot be removed.");
    await ctx.db.patch(attachmentId, { deleted: true, text: "" });
    if (attachment.transcription)
      await ctx.scheduler.runAfter(0, internal.meetings.transcription.provider.cancel, { runId: attachmentId });
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
        if (file.transcription)
          await ctx.scheduler.runAfter(0, internal.meetings.transcription.provider.cancel, { runId: file._id });
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

export async function generationSources(
  ctx: QueryCtx,
  conversationId: Id<"assistantConversations">,
  workspaceId: Id<"workspaces">,
  attachmentIds: Id<"assistantAttachments">[]
) {
  const { conversation } = await requireConversation(ctx, conversationId);
  if (
    conversation.workspaceId !== workspaceId ||
    attachmentIds.length > 100 ||
    new Set(attachmentIds).size !== attachmentIds.length
  )
    throw new ConvexError("Invalid assistant document sources.");
  await authorizedContext(ctx, workspaceId, conversation.context);
  return Promise.all(
    attachmentIds.map(async (id) => {
      const file = await ctx.db.get(id);
      if (!file || file.deleted || file.status !== "ready" || file.conversationId !== conversationId)
        throw new ConvexError("Assistant source is unavailable.");
      await requireAsset(ctx, file.assetId);
      return {
        text: `[Attached file: ${file.name}]\n${file.text}`,
        citation: { kind: "attachment" as const, id: file._id, label: file.name },
      };
    })
  );
}

const audioArgs = { attachmentId: v.id("assistantAttachments"), attempt: v.number() };
async function audioSource(ctx: QueryCtx, attachment: Doc<"assistantAttachments">) {
  if (!attachment.transcription || attachment.deleted || attachment.messageId)
    throw new ConvexError("Audio attachment is unavailable.");
  const user = await requireAccountUser(ctx, attachment.transcription.requesterId);
  const { conversation } = await requireConversationForUser(ctx, attachment.conversationId, user, true);
  await authorizedContextForUser(ctx, conversation.workspaceId, conversation.context, user);
  const asset = await ctx.db.get(attachment.assetId);
  if (
    !asset ||
    asset.status !== "ready" ||
    !asset.storageId ||
    !isAudioAsset(asset) ||
    asset.conversationId !== conversation._id ||
    asset.workspaceId !== conversation.workspaceId ||
    asset.projectId !== null ||
    asset.documentId !== null ||
    asset.createdBy !== user._id
  )
    throw new ConvexError("Audio attachment or its access changed.");
  if (!(await ctx.db.system.get(asset.storageId))) throw new ConvexError("Audio bytes are unavailable.");
  return { ...asset, storageId: asset.storageId };
}
async function failAudio(ctx: MutationCtx, attachment: Doc<"assistantAttachments">, error: string) {
  await ctx.db.patch(attachment._id, { status: "failed", error, text: "" });
  await ctx.scheduler.runAfter(0, internal.meetings.transcription.provider.cancel, { runId: attachment._id });
}
export const startAudio = internalMutation({
  args: { attachmentId: v.id("assistantAttachments") },
  handler: async (ctx, { attachmentId }) => {
    const attachment = await ctx.db.get(attachmentId);
    if (!attachment || attachment.deleted || attachment.messageId) throw new ConvexError("Attachment is unavailable.");
    const { user, conversation } = await requireConversation(ctx, attachment.conversationId, true);
    await authorizedContext(ctx, conversation.workspaceId, conversation.context);
    const { asset } = await requireAsset(ctx, attachment.assetId, true);
    if (!isAudioAsset(asset)) throw new ConvexError("Choose an audio attachment.");
    if (attachment.status === "processing" || attachment.status === "ready") return attachmentId;
    if (attachment.transcription) throw new ConvexError("Remove this failed recording and attach it again.");
    await ctx.db.patch(attachmentId, {
      status: "processing",
      error: null,
      transcription: { requesterId: user._id, attempt: 0, deadline: Date.now() + 2 * 60 * 60 * 1000 },
    });
    await ctx.scheduler.runAfter(0, internal.assistant.attachments.audioTick, { attachmentId, attempt: 0 });
    return attachmentId;
  },
});
export const audioTick = internalMutation({
  args: audioArgs,
  handler: async (ctx, { attachmentId, attempt }) => {
    const attachment = await ctx.db.get(attachmentId);
    if (
      !attachment ||
      attachment.deleted ||
      attachment.status !== "processing" ||
      attachment.transcription?.attempt !== attempt
    )
      return;
    if (Date.now() >= attachment.transcription.deadline) {
      await failAudio(ctx, attachment, "Transcription timed out. Remove the file and attach it again.");
      return;
    }
    try {
      await audioSource(ctx, attachment);
    } catch (error) {
      if (!(error instanceof ConvexError)) throw error;
      await failAudio(ctx, attachment, "The recording or its access changed. Remove the attachment to continue.");
      return;
    }
    const next = { attachmentId, attempt: attempt + 1 };
    await ctx.db.patch(attachmentId, { transcription: { ...attachment.transcription, attempt: next.attempt } });
    // This committed watchdog recovers when the external worker action crashes or times out.
    await ctx.scheduler.runAfter(TRANSCRIPTION_WATCHDOG_DELAY_MS, internal.assistant.attachments.audioTick, next);
    await ctx.scheduler.runAfter(0, internal.assistant.attachment_upload.audioStep, next);
  },
});
export const audioPrepare = internalQuery({
  args: audioArgs,
  handler: async (ctx, { attachmentId, attempt }) => {
    const attachment = await ctx.db.get(attachmentId);
    if (
      !attachment ||
      attachment.deleted ||
      attachment.status !== "processing" ||
      attachment.transcription?.attempt !== attempt ||
      Date.now() >= attachment.transcription.deadline
    )
      return null;
    return audioSource(ctx, attachment);
  },
});
export const audioPoll = internalMutation({
  args: audioArgs,
  handler: async (ctx, args) => {
    const attachment = await ctx.db.get(args.attachmentId);
    if (
      attachment &&
      !attachment.deleted &&
      attachment.status === "processing" &&
      attachment.transcription?.attempt === args.attempt
    )
      await ctx.scheduler.runAfter(5000, internal.assistant.attachments.audioTick, args);
  },
});
export const audioComplete = internalMutation({
  args: { ...audioArgs, text: v.string() },
  handler: async (ctx, { attachmentId, attempt, text }) => {
    const attachment = await ctx.db.get(attachmentId);
    if (
      !attachment ||
      attachment.deleted ||
      attachment.status !== "processing" ||
      attachment.transcription?.attempt !== attempt
    )
      return;
    if (Date.now() >= attachment.transcription.deadline) {
      await failAudio(ctx, attachment, "Transcription timed out. Remove the file and attach it again.");
      return;
    }
    try {
      await audioSource(ctx, attachment);
    } catch (error) {
      if (!(error instanceof ConvexError)) throw error;
      await failAudio(ctx, attachment, "The recording or its access changed. Remove the attachment to continue.");
      return;
    }
    if (!text.trim() || text.length > 120000) throw new ConvexError("Invalid audio transcript.");
    await ctx.db.patch(attachmentId, {
      status: "ready",
      text: text.trim().slice(0, 30000),
      truncated: text.trim().length > 30000,
      error: null,
    });
    await ctx.scheduler.runAfter(0, internal.meetings.transcription.provider.cancel, { runId: attachmentId });
  },
});
export const audioFail = internalMutation({
  args: {
    ...audioArgs,
    error: v.union(
      v.literal("provider_unconfigured"),
      v.literal("invalid_transcript"),
      v.literal("transcription_failed"),
      v.literal("recording_or_access_changed")
    ),
  },
  handler: async (ctx, { attachmentId, attempt, error }) => {
    const attachment = await ctx.db.get(attachmentId);
    if (
      !attachment ||
      attachment.deleted ||
      attachment.status !== "processing" ||
      attachment.transcription?.attempt !== attempt
    )
      return;
    await failAudio(
      ctx,
      attachment,
      error === "provider_unconfigured"
        ? "Audio transcription is unavailable. An administrator must configure the transcription worker. Remove this attachment to continue."
        : error === "recording_or_access_changed"
          ? "The recording or its access changed. Remove the attachment to continue."
          : "Audio could not be transcribed. Remove the file and attach a readable recording again."
    );
  },
});
