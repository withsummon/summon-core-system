"use node";
import { ConvexError } from "convex/values";
import { action } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { internal } from "../_generated/api";
import { copyArgs } from "./copy";
import {
  documentEditorAssetSources,
  duplicateDocumentEditorBinary,
  getBinaryDataFromDocumentEditorHTMLString,
  getAllDocumentFormatsFromDocumentEditorBinaryData,
} from "@plane/editor/lib";
export const run = action({
  args: copyArgs,
  handler: async (ctx, args): Promise<Id<"documents">> => {
    const lookup = await ctx.runQuery(internal.documents.copy.lookup, args);
    if (lookup.job?.resultId) return lookup.job.resultId;
    let jobId = lookup.job?._id;
    if (!jobId) {
      if (!lookup.source) throw new ConvexError("Document copy source unavailable.");
      const binary =
        lookup.source.snapshot?.descriptionBinary ??
        new Uint8Array(getBinaryDataFromDocumentEditorHTMLString("<p></p>", lookup.source.document.name)).buffer;
      jobId = await ctx.runMutation(internal.documents.copy.begin, {
        ...args,
        assetIds: documentEditorAssetSources(new Uint8Array(binary)),
      });
    }
    let progress = await ctx.runQuery(internal.documents.copy.progress, { jobId });
    while (progress.job.cursor < progress.job.files.length) {
      const file = progress.job.files[progress.job.cursor];
      // One blob at a time bounds memory. Durable progress survives action interruption.
      // oxlint-disable-next-line no-await-in-loop
      const blob = await ctx.storage.get(file.sourceStorageId);
      if (!blob) throw new ConvexError("Source image bytes are missing.");
      // oxlint-disable-next-line no-await-in-loop
      const storageId = await ctx.storage.store(blob);
      // oxlint-disable-next-line no-await-in-loop
      await ctx.runMutation(internal.documents.copy.record, { jobId, index: progress.job.cursor, storageId });
      // oxlint-disable-next-line no-await-in-loop
      progress = await ctx.runQuery(internal.documents.copy.progress, { jobId });
    }
    const original =
      progress.source.snapshot?.descriptionBinary ??
      new Uint8Array(getBinaryDataFromDocumentEditorHTMLString("<p></p>", progress.source.document.name)).buffer;
    const sources = Object.fromEntries(progress.job.files.map((file) => [file.sourceId, file.targetId]));
    const binary = duplicateDocumentEditorBinary(new Uint8Array(original), progress.source.name, sources);
    const formats = getAllDocumentFormatsFromDocumentEditorBinaryData(binary, true);
    return ctx.runMutation(internal.documents.copy.publish, {
      jobId,
      descriptionBinary: new Uint8Array(binary).buffer,
      descriptionHtml: formats.contentHTML,
      descriptionJson: formats.contentJSON,
    });
  },
});
