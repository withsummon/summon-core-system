"use node";
import { ConvexError, v } from "convex/values";
import { getAllDocumentFormatsFromDocumentEditorBinaryData, replaceDocumentEditorHTML } from "@plane/editor/lib";
import { action } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { internal } from "../_generated/api";
export const preview = action({
  args: { documentId: v.id("documents"), versionId: v.id("documentRevisions") },
  handler: async (
    ctx,
    args
  ): Promise<{
    versionId: Id<"documentRevisions">;
    revision: number;
    html: string;
    title: string;
    currentRevision: number;
    currentUpdatedAt: number;
  }> => {
    const source = await ctx.runQuery(internal.documents.history.source, { ...args, restore: false });
    const formats = getAllDocumentFormatsFromDocumentEditorBinaryData(
      new Uint8Array(source.historical.descriptionBinary),
      true
    );
    return {
      versionId: source.historical._id,
      revision: source.historical.revision,
      html: formats.contentHTML,
      title: formats.titleHTML ?? "",
      currentRevision: source.document.revision,
      currentUpdatedAt: source.document.updatedAt,
    };
  },
});
export const restore = action({
  args: {
    documentId: v.id("documents"),
    versionId: v.id("documentRevisions"),
    expectedRevision: v.number(),
    expectedUpdatedAt: v.number(),
  },
  handler: async (ctx, args): Promise<number> => {
    const source = await ctx.runQuery(internal.documents.history.source, {
      documentId: args.documentId,
      versionId: args.versionId,
      restore: true,
    });
    if (source.document.revision !== args.expectedRevision || source.document.updatedAt !== args.expectedUpdatedAt)
      throw new ConvexError("Document changed. Review its latest content before restoring.");
    if (!source.current) throw new ConvexError("Current document snapshot is unavailable.");
    const old = getAllDocumentFormatsFromDocumentEditorBinaryData(
      new Uint8Array(source.historical.descriptionBinary),
      false
    );
    const replacement = replaceDocumentEditorHTML(
      new Uint8Array(source.current.descriptionBinary),
      old.contentHTML,
      source.document.name
    );
    const formats = getAllDocumentFormatsFromDocumentEditorBinaryData(replacement, true);
    return ctx.runMutation(internal.documents.history.commit, {
      ...args,
      descriptionBinary: new Uint8Array(replacement).buffer,
      descriptionHtml: formats.contentHTML,
      descriptionJson: formats.contentJSON,
    });
  },
});
