"use node";
import { ConvexError, v } from "convex/values";
import { getAllDocumentFormatsFromDocumentEditorBinaryData, replaceDocumentEditorHTML } from "@plane/editor/lib";
import { action } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { api, internal } from "../_generated/api";
import { MAX_DOCUMENT_SNAPSHOT_BYTES } from "./schema";

export const save = action({
  args: { documentId: v.id("documents"), expectedRevision: v.number(), descriptionBinary: v.bytes() },
  returns: v.number(),
  handler: async (ctx, args): Promise<number> => {
    const access = await ctx.runQuery(api.documents.index.collaborationContext, { documentId: args.documentId });
    if (!access.canWrite) throw new ConvexError("Document is read-only.");
    if (args.descriptionBinary.byteLength === 0 || args.descriptionBinary.byteLength > MAX_DOCUMENT_SNAPSHOT_BYTES)
      throw new ConvexError("Document snapshot exceeds the supported size.");
    let formats: ReturnType<typeof getAllDocumentFormatsFromDocumentEditorBinaryData>;
    try {
      formats = getAllDocumentFormatsFromDocumentEditorBinaryData(new Uint8Array(args.descriptionBinary));
    } catch {
      throw new ConvexError("Document content could not be decoded.");
    }
    return ctx.runMutation(internal.documents.index.saveSnapshot, {
      ...args,
      descriptionHtml: formats.contentHTML,
      descriptionJson: formats.contentJSON,
      name: formats.titleHTML,
    });
  },
});
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
      new Uint8Array(source.historical.descriptionBinary)
    );
    return {
      versionId: source.historical._id,
      revision: source.historical.revision,
      html: formats.contentHTML,
      title: formats.titleHTML,
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
    const old = getAllDocumentFormatsFromDocumentEditorBinaryData(new Uint8Array(source.historical.descriptionBinary));
    const replacement = replaceDocumentEditorHTML(
      new Uint8Array(source.current.descriptionBinary),
      old.contentHTML,
      source.document.name
    );
    const formats = getAllDocumentFormatsFromDocumentEditorBinaryData(replacement);
    return ctx.runMutation(internal.documents.history.commit, {
      ...args,
      descriptionBinary: new Uint8Array(replacement).buffer,
      descriptionHtml: formats.contentHTML,
      descriptionJson: formats.contentJSON,
    });
  },
});
