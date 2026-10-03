import { assetWorkspaceId } from "./access";
import { ConvexError, v } from "convex/values";
import { action } from "../_generated/server";
import { api, internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { isAudioAsset, validateContent } from "./content";

export const finalize = action({
  args: { assetId: v.id("assets"), storageId: v.string() },
  handler: async (ctx, args): Promise<Id<"assets">> => {
    const asset = await ctx.runMutation(internal.assets.index.claim, args);
    if (asset.status === "ready") return asset._id;
    let blob: Blob | null;
    if (isAudioAsset(asset)) {
      const url = await ctx.storage.getUrl(asset.storageId);
      if (!url) throw new ConvexError("Uploaded recording is missing.");
      const response = await fetch(url, { headers: { Range: "bytes=0-11" } });
      const contentType = response.headers.get("content-type");
      if (!response.ok || !response.body || !contentType) {
        await response.body?.cancel();
        throw new ConvexError("Uploaded recording is unavailable.");
      }
      const reader = response.body.getReader();
      const prefix = new Uint8Array(12);
      let length = 0;
      try {
        while (length < prefix.length) {
          // eslint-disable-next-line no-await-in-loop -- Stream chunks must be read sequentially and stop at the prefix budget.
          const chunk = await reader.read();
          if (chunk.done) break;
          const retained = chunk.value.subarray(0, prefix.length - length);
          prefix.set(retained, length);
          length += retained.length;
        }
      } finally {
        // Storage can ignore Range; never accumulate the remaining recording.
        await reader.cancel();
      }
      blob = new Blob([prefix.subarray(0, length)], { type: contentType });
    } else blob = await ctx.storage.get(asset.storageId);
    if (!blob) throw new ConvexError("Uploaded file is missing.");
    try {
      await validateContent(blob, asset.contentType, isAudioAsset(asset));
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

/** Editor node duplication stays within its task or private draft and owns independent bytes. */
export const duplicateDescriptionImage = action({
  args: {
    target: v.union(v.object({ taskId: v.id("tasks") }), v.object({ draftId: v.id("taskDrafts") })),
    assetId: v.string(),
  },
  handler: async (ctx, { target, assetId }): Promise<Id<"assets">> => {
    const source = await ctx.runQuery(internal.assets.index.download, { assetId });
    const bound = "taskId" in target ? source.taskId === target.taskId : source.draftId === target.draftId;
    if (!bound || !source.contentType.startsWith("image/"))
      throw new ConvexError("Image belongs to another work item or is not an image.");
    const blob = source.storageId ? await ctx.storage.get(source.storageId) : null;
    if (!blob) throw new ConvexError("Image bytes are missing.");
    const metadata = {
      name: source.name,
      contentType: source.contentType,
      size: source.size,
      sha256: source.sha256,
    };
    const ticket =
      "taskId" in target
        ? await ctx.runMutation(api.assets.taskAttachments.prepare, { ...target, ...metadata })
        : await ctx.runMutation(api.assets.draftAttachments.prepare, { ...target, ...metadata });
    const storageId = await ctx.storage.store(blob);
    return ctx.runAction(api.assets.upload.finalize, { assetId: ticket.assetId, storageId });
  },
});
