import { ConvexError, v } from "convex/values";
import { action } from "../_generated/server";
import { api, internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
export const finalize = action({
  args: { attachmentId: v.id("assistantAttachments"), storageId: v.string() },
  handler: async (ctx, { attachmentId, storageId }): Promise<Id<"assistantAttachments">> => {
    const source = await ctx.runQuery(internal.assistant.attachments.extractionSource, { attachmentId });
    try {
      await ctx.runAction(api.assets.upload.finalize, { assetId: source.assetId, storageId });
      const asset = await ctx.runQuery(internal.assets.index.download, { assetId: source.assetId });
      const blob = asset.storageId ? await ctx.storage.get(asset.storageId) : null;
      if (!blob) throw new ConvexError("Uploaded text is missing.");
      const decoded = new TextDecoder("utf-8", { fatal: true }).decode(await blob.arrayBuffer()).trim();
      return await ctx.runMutation(internal.assistant.attachments.finish, {
        attachmentId,
        text: decoded.slice(0, 30000),
        truncated: decoded.length > 30000,
      });
    } catch (error) {
      await ctx.runMutation(internal.assistant.attachments.fail, { attachmentId });
      throw error;
    }
  },
});
