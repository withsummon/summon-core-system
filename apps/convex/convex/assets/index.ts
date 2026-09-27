import type { Infer } from "convex/values";
import type { MutationCtx } from "../_generated/server";
import { ConvexError, v } from "convex/values";
import { mutation, query, internalMutation, internalQuery } from "../_generated/server";
import { requireUser } from "../identity/access";
import { assetScope } from "./schema";
import { descriptor, requireAsset, requireAssetScope } from "./access";
import { validateIntent, supportedAssetTypes, assetSizeLimit } from "./content";

export const uploadFields = {
  ...assetScope,
  name: v.string(),
  contentType: v.string(),
  size: v.number(),
  sha256: v.string(),
};
const upload = v.object(uploadFields);
export async function prepareAsset(ctx: MutationCtx, args: Infer<typeof upload>) {
  const { user } = await requireAssetScope(ctx, args, true);
  validateIntent(args.name, args.contentType, args.size, args.sha256);
  const assetId = await ctx.db.insert("assets", {
    ...args,
    createdBy: user._id,
    storageId: null,
    status: "pending",
    expiresAt: Date.now() + 60 * 60 * 1000,
  });
  return { assetId, uploadUrl: await ctx.storage.generateUploadUrl() };
}
export const prepare = mutation({
  args: uploadFields,
  handler: async (ctx, args) => {
    if (args.conversationId) throw new ConvexError("Prepare conversation uploads through assistant attachments.");
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
    if (asset.status === "ready" && asset.storageId === storageId) return asset;
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
    await ctx.db.patch(assetId, { status: "ready" });
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
export const download = internalQuery({
  args: { assetId: v.string() },
  handler: async (ctx, args) => {
    const assetId = ctx.db.normalizeId("assets", args.assetId);
    if (!assetId) throw new ConvexError("Asset not found.");
    return (await requireAsset(ctx, assetId)).asset;
  },
});
export const remove = mutation({
  args: { assetId: v.id("assets") },
  handler: async (ctx, { assetId }) => {
    const { asset } = await requireAsset(ctx, assetId, true);
    if (asset.conversationId) throw new ConvexError("Remove conversation files through assistant attachments.");
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
      imageMaxBytes: assetSizeLimit("image/png"),
      maxBytes: assetSizeLimit("application/pdf"),
    };
  },
});
