import { paginationOptsValidator } from "convex/server";
import { ConvexError, v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { requireWorkspace } from "../identity/access";
import { pageBudget } from "../commercial/validation";

// Deleted documents are deliberately unavailable through requireDocument. Trash
// has its own owner-only boundary; ordinary readers never gain deleted content.
export const trash = query({
  args: { workspaceId: v.id("workspaces"), paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const { user } = await requireWorkspace(ctx, args.workspaceId);
    return ctx.db
      .query("documents")
      .withIndex("by_workspace_owner_deleted", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("ownedBy", user._id).eq("deleted", true)
      )
      .order("desc")
      .paginate(pageBudget(args.paginationOpts));
  },
});

export const restore = mutation({
  args: { documentId: v.id("documents"), expectedUpdatedAt: v.number() },
  handler: async (ctx, args) => {
    const document = await ctx.db.get(args.documentId);
    if (!document) throw new ConvexError("Document not found.");
    const { user } = await requireWorkspace(ctx, document.workspaceId, true);
    if (document.ownedBy !== user._id) throw new ConvexError("Only the owner can restore this document.");
    if (!document.deleted || document.updatedAt !== args.expectedUpdatedAt)
      throw new ConvexError("Document changed. Reload Trash before restoring.");
    await ctx.db.patch(document._id, {
      deleted: false,
      updatedAt: Math.max(Date.now(), document.updatedAt + 1),
      updatedBy: user._id,
    });
    return document._id;
  },
});
