import { ConvexError, v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { query, mutation } from "../_generated/server";
import type { MutationCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { requireWorkspace, requireProject } from "../identity/access";
import { canAccessDocument, requireDocument } from "./access";
import { documentFields, snapshotFields } from "./schema";

async function validateMetadata(
  ctx: MutationCtx,
  workspaceId: Id<"workspaces">,
  data: Pick<Doc<"documents">, keyof typeof documentFields>
) {
  if (data.name.length > 255 || data.category.length > 80 || data.tags.length > 100 || !Number.isFinite(data.sortOrder))
    throw new ConvexError("Invalid document metadata.");
  if (data.projectIds.length > 20 || new Set(data.projectIds).size !== data.projectIds.length)
    throw new ConvexError("Choose up to 20 distinct projects.");
  if (!data.isGlobal && data.projectIds.length === 0 && data.access === "public")
    throw new ConvexError("Public documents need a project or workspace visibility.");
  await Promise.all(
    data.projectIds.map(async (projectId) => {
      const { project } = await requireProject(ctx, projectId, true);
      if (project.workspaceId !== workspaceId) throw new ConvexError("Project belongs to another workspace.");
    })
  );
  await Promise.all(
    [data.clientId, data.opportunityId].map(async (id) => {
      if (!id) return;
      const record = await ctx.db.get(id);
      if (!record || record.deleted || record.workspaceId !== workspaceId)
        throw new ConvexError("Context belongs to another workspace.");
    })
  );
}

export const create = mutation({
  args: { workspaceId: v.id("workspaces"), ...documentFields },
  handler: async (ctx, args) => {
    const { user } = await requireWorkspace(ctx, args.workspaceId, true);
    await validateMetadata(ctx, args.workspaceId, args);
    return ctx.db.insert("documents", {
      ...args,
      ownedBy: user._id,
      revision: 0,
      isLocked: false,
      archived: false,
      deleted: false,
      updatedAt: Date.now(),
      updatedBy: user._id,
    });
  },
});
export const get = query({
  args: { documentId: v.id("documents") },
  handler: async (ctx, args) => (await requireDocument(ctx, args.documentId)).document,
});
export const collaborationContext = query({
  args: { documentId: v.string() },
  handler: async (ctx, args) => {
    const documentId = ctx.db.normalizeId("documents", args.documentId);
    if (!documentId) throw new ConvexError("Document not found.");
    const { document, user, member } = await requireDocument(ctx, documentId);
    const canWrite =
      member.role !== "guest" &&
      !document.isLocked &&
      !document.archived &&
      (await canAccessDocument(ctx, document, user._id, true));
    return {
      documentId,
      userId: user._id,
      name: user.name ?? user.email ?? null,
      documentName: document.name,
      canWrite,
    };
  },
});
export const list = query({
  args: { workspaceId: v.id("workspaces"), paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const { user } = await requireWorkspace(ctx, args.workspaceId);
    if (
      !Number.isSafeInteger(args.paginationOpts.numItems) ||
      args.paginationOpts.numItems < 1 ||
      args.paginationOpts.numItems > 100
    )
      throw new ConvexError("Choose 1–100 documents.");
    const result = await ctx.db
      .query("documents")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId).eq("deleted", false))
      .order("desc")
      .paginate({ ...args.paginationOpts, maximumRowsRead: 100, maximumBytesRead: 1_048_576 });
    const visible = await Promise.all(
      result.page.map(async (document) => ((await canAccessDocument(ctx, document, user._id)) ? document : null))
    );
    return { ...result, page: visible.filter((document) => document !== null) };
  },
});
export const update = mutation({
  args: { documentId: v.id("documents"), ...documentFields },
  handler: async (ctx, { documentId, ...metadata }) => {
    const { document, user } = await requireDocument(ctx, documentId, true);
    if (document.isLocked || document.archived) throw new ConvexError("Document is locked or archived.");
    if (
      document.ownedBy !== user._id &&
      (metadata.access !== document.access ||
        metadata.isGlobal !== document.isGlobal ||
        JSON.stringify(metadata.projectIds) !== JSON.stringify(document.projectIds))
    )
      throw new ConvexError("Only the owner can change document visibility.");
    await validateMetadata(ctx, document.workspaceId, metadata);
    await ctx.db.patch(documentId, { ...metadata, updatedBy: user._id, updatedAt: Date.now() });
  },
});
export const setLifecycle = mutation({
  args: { documentId: v.id("documents"), isLocked: v.boolean(), archived: v.boolean(), deleted: v.boolean() },
  handler: async (ctx, { documentId, ...state }) => {
    const { document, user } = await requireDocument(ctx, documentId, true);
    if (document.ownedBy !== user._id) throw new ConvexError("Only the owner can manage document lifecycle.");
    await ctx.db.patch(documentId, { ...state, updatedBy: user._id, updatedAt: Date.now() });
  },
});
// CAS transport preserves the exact Yjs bytes. The editor/Hocuspocus owner must merge
// concurrent changes and regenerate HTML/JSON before retrying a revision conflict.
export const saveSnapshot = mutation({
  args: {
    documentId: v.id("documents"),
    expectedRevision: v.number(),
    name: v.optional(v.string()),
    ...snapshotFields,
  },
  handler: async (ctx, { documentId, expectedRevision, name, ...snapshot }) => {
    const { document, user } = await requireDocument(ctx, documentId, true);
    if (document.isLocked || document.archived) throw new ConvexError("Document is locked or archived.");
    if (name !== undefined && name.length > 255) throw new ConvexError("Document name must be at most 255 characters.");
    if (!Number.isSafeInteger(expectedRevision) || expectedRevision !== document.revision)
      throw new ConvexError({
        code: "DOCUMENT_REVISION_CONFLICT",
        message: "Document revision conflict. Reload and merge before retrying.",
      });
    if (
      snapshot.descriptionBinary.byteLength === 0 ||
      snapshot.descriptionBinary.byteLength > 524288 ||
      snapshot.descriptionHtml.length > 100000 ||
      JSON.stringify(snapshot.descriptionJson).length > 100000
    )
      throw new ConvexError("Document snapshot exceeds the supported size.");
    const revision = expectedRevision + 1;
    await ctx.db.insert("documentRevisions", { ...snapshot, documentId, revision, createdBy: user._id });
    await ctx.db.patch(documentId, {
      revision,
      updatedAt: Date.now(),
      updatedBy: user._id,
      ...(name === undefined ? {} : { name }),
    });
    return revision;
  },
});
export const snapshot = query({
  args: { documentId: v.id("documents"), revision: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const { document } = await requireDocument(ctx, args.documentId);
    return ctx.db
      .query("documentRevisions")
      .withIndex("by_document_revision", (q) =>
        q.eq("documentId", args.documentId).eq("revision", args.revision ?? document.revision)
      )
      .unique();
  },
});
