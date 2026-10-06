import { requireUsableLabel } from "../tasks/label_access";
import { ConvexError, v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { mutation, query } from "../_generated/server";
import { pageBudget } from "../commercial/validation";
import { projectReader, projectSummary } from "../savedViews/scope";
import { requireDocument, requireMetadataVersion } from "./access";
export const list = query({
  args: { documentId: v.id("documents"), paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const { document, user } = await requireDocument(ctx, args.documentId);
    const read = projectReader(ctx, document.workspaceId, user._id);
    const result = await ctx.db
      .query("documentLabels")
      .withIndex("by_document", (q) => q.eq("documentId", document._id))
      .paginate(pageBudget(args.paginationOpts));
    const page = await Promise.all(
      result.page.map(async (relation) => {
        const label = await ctx.db.get(relation.labelId);
        const permission =
          label && label.workspaceId === document.workspaceId && label.projectId !== null
            ? await read(label.projectId)
            : null;
        return {
          labelId: relation.labelId,
          label:
            label && label.workspaceId === document.workspaceId && (label.projectId === null || permission)
              ? {
                  name: label.name,
                  color: label.color,
                  project: permission ? projectSummary(permission.project) : null,
                }
              : null,
        };
      })
    );
    return { ...result, page };
  },
});
export const set = mutation({
  args: {
    documentId: v.id("documents"),
    labelId: v.id("taskLabels"),
    assigned: v.boolean(),
    expectedUpdatedAt: v.number(),
  },
  handler: async (ctx, args) => {
    const { document, user } = await requireDocument(ctx, args.documentId, true);
    if (document.isLocked || document.archived) throw new ConvexError("Document is locked or archived.");
    requireMetadataVersion(document, args.expectedUpdatedAt);
    const existing = await ctx.db
      .query("documentLabels")
      .withIndex("by_document_label", (q) => q.eq("documentId", document._id).eq("labelId", args.labelId))
      .unique();
    if (args.assigned) {
      if (existing) return;
      const label = await requireUsableLabel(ctx, args.labelId);
      const read = projectReader(ctx, document.workspaceId, user._id);
      if (
        !label ||
        label.workspaceId !== document.workspaceId ||
        (label.projectId !== null && !(await read(label.projectId)))
      )
        throw new ConvexError("Label is unavailable.");
      await ctx.db.insert("documentLabels", { documentId: document._id, labelId: label._id });
    } else {
      if (!existing) throw new ConvexError("Document label not found.");
      await ctx.db.delete(existing._id);
    }
    await ctx.db.patch(document._id, { updatedAt: Math.max(Date.now(), document.updatedAt + 1), updatedBy: user._id });
  },
});
