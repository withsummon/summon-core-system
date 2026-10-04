import type { Id } from "../_generated/dataModel";
import { requireApiAvatar } from "../identity/avatar_access";
import { publishPersonalImage } from "../identity/avatar_owner";
import { publishProjectCover } from "../projects/cover_owner";
import { publishWorkspaceLogo } from "../settings/logo_owner";
import { draftAttachmentChanged } from "./draft_access";
import { requireTaskAttachmentAccess } from "./task_access";
import { taskChanged } from "../tasks/revision";
import type { Infer } from "convex/values";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { ConvexError, v } from "convex/values";
import { mutation, query, internalMutation, internalQuery } from "../_generated/server";
import { requireUser } from "../identity/access";
import { assetScope, fileMetadataFields, commentImageTarget } from "./schema";
import { requireCommentImageTarget, requirePublicCommentImage } from "./commentImages";
import { compareValues } from "convex/values";
import type { personalImagePurpose } from "./schema";
import { descriptor, requireAsset, requireAssetScope } from "./access";
import { isAudioAsset, validateIntent, supportedAssetTypes, assetSizeLimit, assetTypesByExtension } from "./content";

export const uploadFields = {
  ...assetScope,
  ...fileMetadataFields,
};
const upload = v.object(uploadFields);
export async function prepareAsset(
  ctx: MutationCtx,
  args: Omit<Infer<typeof upload>, "workspaceId"> & { workspaceId: Id<"workspaces"> | null },
  appearance?:
    | { purpose: "workspaceLogo"; workspaceLogoRevision: number }
    | { purpose: "projectCover"; projectCoverRevision: number; projectCoverFormRevision?: number }
    | { purpose: Infer<typeof personalImagePurpose>; avatarUserId: Id<"users">; avatarRevision: number }
) {
  const { user } = await requireAssetScope(ctx, { ...args, ...appearance }, true);
  validateIntent(args.name, args.contentType, args.size, args.sha256, isAudioAsset(args));
  const assetId = await ctx.db.insert("assets", {
    ...args,
    ...appearance,
    createdBy: user._id,
    ...(args.taskId || args.draftId ? { attachmentRevision: 0 } : {}),
    storageId: null,
    status: "pending",
    expiresAt: Date.now() + 60 * 60 * 1000,
  });
  return { assetId, uploadUrl: await ctx.storage.generateUploadUrl() };
}
export const prepare = mutation({
  args: uploadFields,
  handler: async (ctx, args) => {
    if (args.commentUpload || args.commentId) throw new ConvexError("Prepare comment images through comments.");
    if (args.automationJobId) throw new ConvexError("Generated files are created by their generation job.");
    if (args.exportJobId) throw new ConvexError("Export files are created by their export job.");
    if (args.draftId) throw new ConvexError("Prepare draft uploads through draft attachments.");
    if (args.taskId) throw new ConvexError("Prepare task uploads through task attachments.");
    if (args.conversationId) throw new ConvexError("Prepare conversation uploads through assistant attachments.");
    if (args.meetingId) throw new ConvexError("Prepare meeting recordings through meeting recording uploads.");
    return prepareAsset(ctx, args);
  },
});
export const claim = internalMutation({
  args: { assetId: v.id("assets"), storageId: v.string() },
  handler: async (ctx, { assetId, storageId: rawStorageId }) => {
    const storageId = ctx.db.system.normalizeId("_storage", rawStorageId);
    if (!storageId) throw new ConvexError("Invalid upload storage ID.");
    const user = await requireUser(ctx);
    const asset = await ctx.db.get(assetId);
    if (!asset || asset.createdBy !== user._id) throw new ConvexError("Upload not found.");
    await requireAssetScope(ctx, asset, true);
    if (asset.status === "ready" && asset.storageId === storageId) return { ...asset, storageId };
    if (asset.status !== "pending" || asset.expiresAt <= Date.now())
      throw new ConvexError("Upload has expired or is closed.");
    if (asset.storageId && asset.storageId !== storageId) throw new ConvexError("Upload already claimed another file.");
    const existing = await ctx.db
      .query("assets")
      .withIndex("by_storage", (q) => q.eq("storageId", storageId))
      .unique();
    if (existing && existing._id !== assetId) throw new ConvexError("File is already claimed by another asset.");
    const metadata = await ctx.db.system.get(storageId);
    if (
      !metadata ||
      metadata._creationTime < asset._creationTime ||
      metadata.size !== asset.size ||
      metadata.sha256 !== asset.sha256
    )
      throw new ConvexError("Uploaded file does not match the upload request.");
    await ctx.db.patch(assetId, { storageId });
    return { ...asset, storageId };
  },
});
export const commit = internalMutation({
  args: { assetId: v.id("assets") },
  handler: async (ctx, { assetId }) => {
    const user = await requireUser(ctx);
    const asset = await ctx.db.get(assetId);
    if (!asset || asset.createdBy !== user._id || !asset.storageId) throw new ConvexError("Upload not found.");
    await requireAssetScope(ctx, asset, true);
    if (asset.status === "ready") return assetId;
    if (asset.status !== "pending" || asset.expiresAt <= Date.now())
      throw new ConvexError("Upload has expired or is closed.");
    if (!(await ctx.db.system.get(asset.storageId))) throw new ConvexError("Uploaded file is missing.");
    if (asset.purpose === "workspaceLogo") await publishWorkspaceLogo(ctx, asset);
    if (asset.purpose === "projectCover" && asset.projectCoverFormRevision === undefined)
      await publishProjectCover(ctx, asset);
    if (asset.purpose === "userAvatar" || asset.purpose === "userCover") await publishPersonalImage(ctx, asset);
    await ctx.db.patch(assetId, { status: "ready" });
    if (asset.draftId) await draftAttachmentChanged(ctx, asset.draftId);
    if (asset.taskId) {
      const { task } = await requireTaskAttachmentAccess(ctx, asset.taskId, true);
      await taskChanged(ctx, task, user._id);
    }
    return assetId;
  },
});
export const reject = internalMutation({
  args: { assetId: v.id("assets") },
  handler: async (ctx, { assetId }) => {
    const user = await requireUser(ctx);
    const asset = await ctx.db.get(assetId);
    if (!asset || asset.createdBy !== user._id || asset.status !== "pending") return;
    if (asset.storageId) await ctx.storage.delete(asset.storageId);
    await ctx.db.patch(assetId, { status: "rejected", storageId: null });
  },
});
export const get = query({
  args: { assetId: v.id("assets") },
  handler: async (ctx, { assetId }) => descriptor((await requireAsset(ctx, assetId)).asset),
});
const commentUploadFields = { target: commentImageTarget, ...fileMetadataFields };
async function prepareCommentImageAsset(ctx: MutationCtx, args: Infer<typeof commentImageUpload>) {
  if (!args.contentType.startsWith("image/")) throw new ConvexError("Comments accept images only.");
  const { task, target } = await requireCommentImageTarget(ctx, args.target);
  const { target: _target, ...metadata } = args;
  return prepareAsset(ctx, {
    ...metadata,
    commentUpload: target,
    workspaceId: task.workspaceId,
    projectId: task.projectId,
    documentId: null,
  });
}
const commentImageUpload = v.object(commentUploadFields);
export const prepareCommentImage = mutation({
  args: commentUploadFields,
  handler: async (ctx, args) => {
    if (args.target.anchor !== null) throw new ConvexError("Use public comment uploads for a publication.");
    return prepareCommentImageAsset(ctx, args);
  },
});
export const preparePublicCommentImage = mutation({
  args: commentUploadFields,
  handler: async (ctx, args) => {
    if (args.target.anchor === null) throw new ConvexError("Public comment upload requires its publication.");
    return prepareCommentImageAsset(ctx, args);
  },
});
async function resolveCommentImageAsset(ctx: QueryCtx, target: Infer<typeof commentImageTarget>, rawId: string) {
  const assetId = ctx.db.normalizeId("assets", rawId);
  const asset = assetId ? await ctx.db.get(assetId) : null;
  if (!asset || asset.status !== "ready") return null;
  if (asset.commentUpload) {
    await requireAssetScope(ctx, asset, false);
    if (compareValues(asset.commentUpload, target) !== 0) throw new ConvexError("Image belongs to another composer.");
    return asset;
  }
  const comment = asset.commentId ? await ctx.db.get(asset.commentId) : null;
  if (!comment || comment.taskId !== target.taskId) throw new ConvexError("Image belongs to another work item.");
  if ("requestId" in target) {
    const { user } = await requireCommentImageTarget(ctx, target);
    if (
      comment.authorId !== user._id ||
      comment.creation?.requestId !== target.requestId ||
      comment.creation.anchor !== target.anchor
    )
      throw new ConvexError("Image belongs to another composer.");
  } else if (comment._id !== target.commentId) throw new ConvexError("Image belongs to another comment.");
  if (target.anchor !== null) await requirePublicCommentImage(ctx, target.anchor, target.taskId, comment._id, asset);
  else await requireAssetScope(ctx, asset, false);
  return asset;
}
export const resolveCommentImage = query({
  args: { target: commentImageTarget, assetId: v.string() },
  handler: async (ctx, { target, assetId }) => {
    const asset = await resolveCommentImageAsset(ctx, target, assetId);
    if (!asset) return null;
    if (target.anchor === null || asset.commentUpload) return descriptor(asset);
    return {
      id: asset._id,
      name: asset.name,
      contentType: asset.contentType,
      size: asset.size,
      downloadPath: `/assets/${asset._id}?anchor=${encodeURIComponent(target.anchor)}&task=${target.taskId}&comment=${asset.commentId}`,
    };
  },
});
export const publicCommentImage = internalQuery({
  args: { anchor: v.string(), taskId: v.string(), commentId: v.string(), assetId: v.string() },
  handler: async (ctx, args) => {
    const taskId = ctx.db.normalizeId("tasks", args.taskId);
    const commentId = ctx.db.normalizeId("taskComments", args.commentId);
    const assetId = ctx.db.normalizeId("assets", args.assetId);
    const asset = assetId ? await ctx.db.get(assetId) : null;
    if (!taskId || !commentId || !asset) throw new ConvexError("Comment image not found.");
    return requirePublicCommentImage(ctx, args.anchor, taskId, commentId, asset);
  },
});
export const download = internalQuery({
  args: { assetId: v.string(), readWorkspaceId: v.optional(v.string()), commentTarget: v.optional(commentImageTarget) },
  handler: async (ctx, args) => {
    if (args.commentTarget) {
      if (args.readWorkspaceId) throw new ConvexError("Comment image cannot have another read scope.");
      const asset = await resolveCommentImageAsset(ctx, args.commentTarget, args.assetId);
      if (!asset) throw new ConvexError("Comment image not found.");
      return asset;
    }
    const assetId = ctx.db.normalizeId("assets", args.assetId);
    if (!assetId) throw new ConvexError("Asset not found.");
    const readWorkspaceId =
      args.readWorkspaceId === undefined ? undefined : ctx.db.normalizeId("workspaces", args.readWorkspaceId);
    if (readWorkspaceId === null) throw new ConvexError("Workspace not found.");
    return (await requireAsset(ctx, assetId, false, readWorkspaceId)).asset;
  },
});
export const apiAvatar = internalQuery({
  args: { userId: v.id("users"), assetId: v.string() },
  handler: (ctx, { userId, assetId }) => requireApiAvatar(ctx, userId, assetId),
});
export const remove = mutation({
  args: { assetId: v.id("assets") },
  handler: async (ctx, { assetId }) => {
    const { asset } = await requireAsset(ctx, assetId, true);
    if (asset.commentUpload || asset.commentId) throw new ConvexError("Remove image references through their comment.");
    if (asset.purpose === "userAvatar" || asset.purpose === "userCover")
      throw new ConvexError("Remove profile images through your profile.");
    if (asset.purpose === "workspaceLogo")
      throw new ConvexError("Remove workspace logos through workspace appearance.");
    if (asset.purpose === "projectCover") throw new ConvexError("Remove project covers through project appearance.");
    if (asset.automationJobId) throw new ConvexError("Generated files belong to their generation job.");
    if (asset.exportJobId) throw new ConvexError("Export files belong to their export job.");
    if (asset.draftId) throw new ConvexError("Remove draft files through draft attachments.");
    if (asset.taskId) throw new ConvexError("Remove task files through task attachments.");
    if (asset.conversationId) throw new ConvexError("Remove conversation files through assistant attachments.");
    if (asset.meetingId) throw new ConvexError("Remove meeting recordings through their meeting.");
    await ctx.db.patch(assetId, { status: "deleted", expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000 });
  },
});

// The editor persists string IDs in Yjs. Normalize at the database owner and
// bind resolution to the active document instead of casting strings in clients.
export const resolveDocumentAsset = query({
  args: { documentId: v.id("documents"), assetId: v.string() },
  handler: async (ctx, { documentId, assetId: rawId }) => {
    const assetId = ctx.db.normalizeId("assets", rawId);
    if (!assetId) return null;
    const asset = await ctx.db.get(assetId);
    if (!asset || asset.status !== "ready") return null;
    await requireAssetScope(ctx, asset, false);
    if (asset.documentId !== documentId) throw new ConvexError("Asset belongs to another document.");
    return descriptor(asset);
  },
});
export const restore = mutation({
  args: { documentId: v.id("documents"), assetId: v.string() },
  handler: async (ctx, { documentId, assetId: rawId }) => {
    const assetId = ctx.db.normalizeId("assets", rawId);
    const asset = assetId ? await ctx.db.get(assetId) : null;
    if (!asset || !asset.storageId || !["ready", "deleted"].includes(asset.status))
      throw new ConvexError("Asset cannot be restored.");
    await requireAssetScope(ctx, asset, true);
    if (asset.documentId !== documentId) throw new ConvexError("Asset belongs to another document.");
    if (asset.status === "deleted" && asset.expiresAt <= Date.now()) throw new ConvexError("Restore period expired.");
    if (!(await ctx.db.system.get(asset.storageId))) throw new ConvexError("Asset bytes are missing.");
    await ctx.db.patch(asset._id, { status: "ready" });
    return asset._id;
  },
});

export const policy = query({
  args: {},
  handler: async (ctx) => {
    await requireUser(ctx);
    return {
      supportedTypes: [...supportedAssetTypes],
      typesByExtension: assetTypesByExtension,
      imageMaxBytes: assetSizeLimit("image/png"),
      maxBytes: assetSizeLimit("application/pdf"),
    };
  },
});
