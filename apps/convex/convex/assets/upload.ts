import { assetWorkspaceId } from "./access";
import { ConvexError, v } from "convex/values";
import { action } from "../_generated/server";
import { api, internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { validateContent } from "./content";

export const finalize = action({
  args: { assetId: v.id("assets"), storageId: v.string() },
  handler: async (ctx, args): Promise<Id<"assets">> => {
    const asset = await ctx.runMutation(internal.assets.index.claim, args);
    if (asset.status === "ready") return asset._id;
    const blob = await ctx.storage.get(asset.storageId!);
    if (!blob) throw new ConvexError("Uploaded file is missing.");
    try {
      await validateContent(blob, asset.contentType);
    } catch (error) {
      await ctx.runMutation(internal.assets.index.reject, { assetId: asset._id });
      throw error;
    }
    return ctx.runMutation(internal.assets.index.commit, { assetId: asset._id });
  },
});

export const duplicate = action({
  args: { documentId: v.id("documents"), assetId: v.string() },
  handler: async (ctx, { documentId, assetId }): Promise<Id<"assets">> => {
    const source = await ctx.runQuery(internal.assets.index.download, { assetId });
    if (source.documentId !== documentId) throw new ConvexError("Asset belongs to another document.");
    const blob = source.storageId ? await ctx.storage.get(source.storageId) : null;
    if (!blob) throw new ConvexError("Asset bytes are missing.");
    const ticket = await ctx.runMutation(api.assets.index.prepare, {
      workspaceId: assetWorkspaceId(source),
      projectId: source.projectId,
      documentId,
      name: source.name,
      contentType: source.contentType,
      size: source.size,
      sha256: source.sha256,
    });
    // Copies get independent storage ownership, so delete/undo cannot affect
    // the original. Interrupted copies are covered by the orphan sweep.
    const storageId = await ctx.storage.store(blob);
    return ctx.runAction(api.assets.upload.finalize, { assetId: ticket.assetId, storageId });
  },
});

/** Same-task image duplication has independent byte ownership and the existing orphan cleanup. */
export const duplicateTaskImage = action({
  args: { taskId: v.id("tasks"), assetId: v.string() },
  handler: async (ctx, { taskId, assetId }): Promise<Id<"assets">> => {
    const source = await ctx.runQuery(internal.assets.index.download, { assetId });
    if (source.taskId !== taskId || !source.contentType.startsWith("image/"))
      throw new ConvexError("Image belongs to another task or is not an image.");
    const blob = source.storageId ? await ctx.storage.get(source.storageId) : null;
    if (!blob) throw new ConvexError("Image bytes are missing.");
    const ticket = await ctx.runMutation(api.assets.taskAttachments.prepare, {
      taskId,
      name: source.name,
      contentType: source.contentType,
      size: source.size,
      sha256: source.sha256,
    });
    const storageId = await ctx.storage.store(blob);
    return ctx.runAction(api.assets.upload.finalize, { assetId: ticket.assetId, storageId });
  },
});
