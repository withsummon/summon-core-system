import { ConvexError, v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { query, mutation } from "../_generated/server";
import type { QueryCtx } from "../_generated/server";
import type { Id, Doc } from "../_generated/dataModel";
import { pageBudget } from "../commercial/validation";
import { requireDocument, canAccessDocument, requireMetadataVersion } from "./access";
export const MAX_DOCUMENT_DEPTH = 20;
export const MAX_DOCUMENT_SUBTREE = 1000;
async function edge(ctx: QueryCtx, documentId: Id<"documents">) {
  return ctx.db
    .query("documentParents")
    .withIndex("by_document", (q) => q.eq("documentId", documentId))
    .unique();
}
function movable(document: Doc<"documents">) {
  if (document.isLocked || document.archived) throw new ConvexError("Document is locked or archived.");
}
export const parent = query({
  args: { documentId: v.id("documents") },
  handler: async (ctx, args) => {
    const { document, user } = await requireDocument(ctx, args.documentId);
    const relation = await edge(ctx, document._id);
    const parentDocument = relation ? await ctx.db.get(relation.parentId) : null;
    return {
      hasParent: relation !== null,
      parent:
        parentDocument &&
        parentDocument.workspaceId === document.workspaceId &&
        (await canAccessDocument(ctx, parentDocument, user._id))
          ? { id: parentDocument._id, name: parentDocument.name, archived: parentDocument.archived }
          : null,
    };
  },
});
export const children = query({
  args: { documentId: v.id("documents"), paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const { document, user } = await requireDocument(ctx, args.documentId);
    const result = await ctx.db
      .query("documentParents")
      .withIndex("by_parent", (q) => q.eq("parentId", document._id))
      .paginate(pageBudget(args.paginationOpts));
    const page = await Promise.all(
      result.page.map(async (relation) => {
        const child = await ctx.db.get(relation.documentId);
        return child && child.workspaceId === document.workspaceId && (await canAccessDocument(ctx, child, user._id))
          ? child
          : null;
      })
    );
    return { ...result, page: page.filter((row) => row !== null) };
  },
});
export const choices = query({
  args: { documentId: v.id("documents"), paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const { document, user } = await requireDocument(ctx, args.documentId, true);
    movable(document);
    const result = await ctx.db
      .query("documents")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", document.workspaceId).eq("deleted", false))
      .order("desc")
      .paginate(pageBudget(args.paginationOpts));
    const page = await Promise.all(
      result.page.map(async (candidate) => {
        if (candidate._id === document._id || candidate.isLocked || candidate.archived) return null;
        return (await canAccessDocument(ctx, candidate, user._id, true))
          ? { id: candidate._id, name: candidate.name, updatedAt: candidate.updatedAt }
          : null;
      })
    );
    return { ...result, page: page.filter((row) => row !== null) };
  },
});
async function destinationDepth(ctx: QueryCtx, documentId: Id<"documents">, parentId: Id<"documents">) {
  let current: Id<"documents"> | null = parentId;
  let depth = 0;
  while (current) {
    if (current === documentId) throw new ConvexError("A document cannot be moved inside itself or its descendants.");
    if (++depth >= MAX_DOCUMENT_DEPTH)
      throw new ConvexError(`Document hierarchy supports at most ${MAX_DOCUMENT_DEPTH} levels.`);
    // Each ancestor lookup depends on the preceding edge.
    // oxlint-disable-next-line no-await-in-loop
    current = (await edge(ctx, current))?.parentId ?? null;
  }
  return depth;
}
async function subtreeHeight(ctx: QueryCtx, documentId: Id<"documents">) {
  const queue = [{ id: documentId, depth: 1 }];
  let height = 1;
  for (let cursor = 0; cursor < queue.length; cursor++) {
    const current = queue[cursor];
    // Check the global traversal budget before reading the next branch.
    // oxlint-disable-next-line no-await-in-loop
    const childEdges = await ctx.db
      .query("documentParents")
      .withIndex("by_parent", (q) => q.eq("parentId", current.id))
      .take(MAX_DOCUMENT_SUBTREE + 1);
    if (queue.length + childEdges.length > MAX_DOCUMENT_SUBTREE)
      throw new ConvexError(`Moving a document is limited to ${MAX_DOCUMENT_SUBTREE} documents in its subtree.`);
    for (const child of childEdges) {
      const depth = current.depth + 1;
      if (depth > MAX_DOCUMENT_DEPTH)
        throw new ConvexError(`Document hierarchy supports at most ${MAX_DOCUMENT_DEPTH} levels.`);
      height = Math.max(height, depth);
      queue.push({ id: child.documentId, depth });
    }
  }
  return height;
}
export const move = mutation({
  args: {
    documentId: v.id("documents"),
    expectedUpdatedAt: v.number(),
    parentId: v.union(v.id("documents"), v.null()),
    expectedParentUpdatedAt: v.union(v.number(), v.null()),
  },
  handler: async (ctx, args) => {
    const { document, user } = await requireDocument(ctx, args.documentId, true);
    movable(document);
    requireMetadataVersion(document, args.expectedUpdatedAt);
    const existing = await edge(ctx, document._id);
    if (args.parentId) {
      const { document: parentDocument } = await requireDocument(ctx, args.parentId, true);
      movable(parentDocument);
      if (parentDocument.workspaceId !== document.workspaceId)
        throw new ConvexError("Parent document must belong to the same workspace.");
      if (args.expectedParentUpdatedAt === null) throw new ConvexError("Parent document revision is required.");
      requireMetadataVersion(parentDocument, args.expectedParentUpdatedAt);
      const depth = await destinationDepth(ctx, document._id, parentDocument._id);
      if (depth + (await subtreeHeight(ctx, document._id)) > MAX_DOCUMENT_DEPTH)
        throw new ConvexError(
          `Document hierarchy supports at most ${MAX_DOCUMENT_DEPTH} levels, including nested children.`
        );
      if (existing) await ctx.db.patch(existing._id, { parentId: parentDocument._id });
      else await ctx.db.insert("documentParents", { documentId: document._id, parentId: parentDocument._id });
    } else if (existing) await ctx.db.delete(existing._id);
    await ctx.db.patch(document._id, { updatedAt: Math.max(Date.now(), document.updatedAt + 1), updatedBy: user._id });
    return document._id;
  },
});

/** Copying a leaf keeps its parent through the same destination rules as moving. */
export async function documentCopyParent(ctx: QueryCtx, document: Doc<"documents">) {
  const relation = await edge(ctx, document._id);
  if (!relation) return { parentId: null, parentUpdatedAt: null };
  const { document: parentDocument } = await requireDocument(ctx, relation.parentId, true);
  movable(parentDocument);
  if (parentDocument.workspaceId !== document.workspaceId)
    throw new ConvexError("Parent document must belong to the same workspace.");
  await destinationDepth(ctx, document._id, parentDocument._id);
  return { parentId: parentDocument._id, parentUpdatedAt: parentDocument.updatedAt };
}
