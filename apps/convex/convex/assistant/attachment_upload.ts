"use node";
import { ConvexError, v } from "convex/values";
import { action, internalAction } from "../_generated/server";
import { api, internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { transcribe } from "../meetings/transcription/provider";
export const finalize = action({
  args: { attachmentId: v.id("assistantAttachments"), storageId: v.string() },
  handler: async (ctx, { attachmentId, storageId }): Promise<Id<"assistantAttachments">> => {
    const source = await ctx.runQuery(internal.assistant.attachments.extractionSource, { attachmentId });
    try {
      await ctx.runAction(api.assets.upload.finalize, { assetId: source.assetId, storageId });
      if (source.contentType.startsWith("audio/"))
        return await ctx.runMutation(internal.assistant.attachments.startAudio, { attachmentId });
      const extracted = await ctx.runAction(api.automation.generate.extract, { assetId: source.assetId });
      return await ctx.runMutation(internal.assistant.attachments.finish, {
        attachmentId,
        text: extracted.text,
        truncated: extracted.truncated,
      });
    } catch (error) {
      await ctx.runMutation(internal.assistant.attachments.fail, { attachmentId });
      throw error;
    }
  },
});

export const audioStep = internalAction({
  args: { attachmentId: v.id("assistantAttachments"), attempt: v.number() },
  handler: async (ctx, args) => {
    try {
      const asset = await ctx.runQuery(internal.assistant.attachments.audioPrepare, args);
      if (!asset) return;
      const result = await transcribe(args.attachmentId, asset, async () => {
        const current = await ctx.runQuery(internal.assistant.attachments.audioPrepare, args);
        return current ? ctx.storage.getUrl(current.storageId) : null;
      });
      if (result.status === "completed")
        await ctx.runMutation(internal.assistant.attachments.audioComplete, { ...args, text: result.text });
      else if (result.status === "unavailable")
        await ctx.runMutation(internal.assistant.attachments.audioFail, { ...args, error: result.error });
      else if (result.status === "failed" || result.status === "cancelled")
        await ctx.runMutation(internal.assistant.attachments.audioFail, { ...args, error: "transcription_failed" });
      else await ctx.runMutation(internal.assistant.attachments.audioPoll, args);
    } catch (error) {
      if (!(error instanceof ConvexError)) throw error;
      await ctx.runMutation(internal.assistant.attachments.audioFail, {
        ...args,
        error: "recording_or_access_changed",
      });
    }
  },
});
