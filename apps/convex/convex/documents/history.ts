import { ConvexError, v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { query, internalQuery, internalMutation } from "../_generated/server";
import { internal } from "../_generated/api";
import { pageBudget } from "../commercial/validation";
import { requireDocument, requireMetadataVersion } from "./access";
import { snapshotFields } from "./schema";
import { saveDocumentSnapshot } from "./index";
export const list = query({
  args: { documentId: v.id("documents"), paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    await requireDocument(ctx, args.documentId);
    const page = await ctx.db
      .query("documentRevisions")
      .withIndex("by_document_revision", (q) => q.eq("documentId", args.documentId))
      .order("desc")
      .paginate(pageBudget(args.paginationOpts));
    return {
      ...page,
      page: page.page.map((row) => ({
        id: row._id,
        revision: row.revision,
        createdAt: row._creationTime,
        createdBy: row.createdBy,
      })),
    };
  },
});
export const source = internalQuery({
  args: { documentId: v.id("documents"), versionId: v.id("documentRevisions"), restore: v.boolean() },
  handler: async (ctx, args) => {
    const { document } = await requireDocument(ctx, args.documentId, args.restore);
    if (args.restore && (document.isLocked || document.archived))
      throw new ConvexError("Document is locked or archived.");
    const historical = await ctx.db.get(args.versionId);
    if (!historical || historical.documentId !== document._id) throw new ConvexError("Document version not found.");
    const current = await ctx.db
      .query("documentRevisions")
      .withIndex("by_document_revision", (q) => q.eq("documentId", document._id).eq("revision", document.revision))
      .unique();
    return { document, historical, current };
  },
});
export const commit = internalMutation({
  args: {
    documentId: v.id("documents"),
    versionId: v.id("documentRevisions"),
    expectedRevision: v.number(),
    expectedUpdatedAt: v.number(),
    ...snapshotFields,
  },
  handler: async (ctx, args) => {
    const { document } = await requireDocument(ctx, args.documentId, true);
    requireMetadataVersion(document, args.expectedUpdatedAt);
    const version = await ctx.db.get(args.versionId);
    if (!version || version.documentId !== document._id) throw new ConvexError("Document version not found.");
    return saveDocumentSnapshot(ctx, {
      documentId: document._id,
      expectedRevision: args.expectedRevision,
      descriptionBinary: args.descriptionBinary,
      descriptionHtml: args.descriptionHtml,
      descriptionJson: args.descriptionJson,
    });
  },
});

// Match the inherited 20 versions per page without reading current snapshots.
export const prune = internalMutation({
  args: { cursor: v.union(v.string(), v.null()) },
  handler: async (ctx, { cursor }) => {
    const documents = await ctx.db.query("documents").paginate({ numItems: 1, cursor });
    const document = documents.page[0];
    const old = document
      ? await ctx.db
          .query("documentRevisions")
          .withIndex("by_document_revision", (q) =>
            q.eq("documentId", document._id).lt("revision", document.revision - 19)
          )
          .take(10)
      : [];
    await Promise.all(old.map((revision) => ctx.db.delete(revision._id)));
    if (old.length === 10 || !documents.isDone)
      await ctx.scheduler.runAfter(0, internal.documents.history.prune, {
        cursor: old.length === 10 ? cursor : documents.continueCursor,
      });
  },
});
