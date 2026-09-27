import { ConvexError, v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { query, mutation, internalMutation } from "../_generated/server";
import type { QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { requireUser } from "../identity/access";
import { pageBudget } from "../commercial/validation";

async function requireLifecycle(ctx: QueryCtx, workspaceId: Id<"workspaces">) {
  const user = await requireUser(ctx);
  const member = await ctx.db
    .query("workspaceMembers")
    .withIndex("by_workspace_user", (q) => q.eq("workspaceId", workspaceId).eq("userId", user._id))
    .unique();
  if (!member?.active || member.role !== "admin")
    throw new ConvexError("Only current workspace administrators can manage workspace Trash.");
  const workspace = await ctx.db.get(workspaceId);
  if (!workspace) throw new ConvexError("Workspace not found.");
  return workspace;
}
function projection(workspace: Doc<"workspaces">) {
  return {
    id: workspace._id,
    name: workspace.name,
    slug: workspace.slug,
    deletedAt: workspace.deletedAt ?? null,
    revision: workspace.metadataRevision,
  };
}
export const get = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => projection(await requireLifecycle(ctx, args.workspaceId)),
});
export const list = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const page = await ctx.db
      .query("workspaceMembers")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .paginate(pageBudget(args.paginationOpts));
    const rows = await Promise.all(
      page.page.map(async (member) => {
        if (!member.active || member.role !== "admin") return null;
        const workspace = await ctx.db.get(member.workspaceId);
        return workspace && workspace.deletedAt != null ? projection(workspace) : null;
      })
    );
    return { ...page, page: rows.filter((row) => row !== null) };
  },
});
export const setDeleted = mutation({
  args: { workspaceId: v.id("workspaces"), deleted: v.boolean(), expectedRevision: v.number() },
  handler: async (ctx, args) => {
    const workspace = await requireLifecycle(ctx, args.workspaceId);
    if (!Number.isSafeInteger(args.expectedRevision) || workspace.metadataRevision !== args.expectedRevision)
      throw new ConvexError("Workspace changed. Reopen its latest settings before continuing.");
    if ((workspace.deletedAt != null) === args.deleted) return;
    await ctx.db.patch(workspace._id, {
      deletedAt: args.deleted ? Date.now() : null,
      metadataRevision: workspace.metadataRevision + 1,
    });
  },
});
// Temporary additive migration: require deletedAt only after both deployments
// complete all cursor pages twice with zero changes on the second pass.
export const backfill = internalMutation({
  args: { cursor: v.union(v.string(), v.null()) },
  handler: async (ctx, args) => {
    const page = await ctx.db
      .query("workspaces")
      .paginate({ numItems: 50, cursor: args.cursor, maximumRowsRead: 100, maximumBytesRead: 1024 * 1024 });
    let changed = 0;
    for (const workspace of page.page)
      if (workspace.deletedAt === undefined) {
        await ctx.db.patch(workspace._id, { deletedAt: null });
        changed++;
      }
    return { processed: page.page.length, changed, cursor: page.continueCursor, isDone: page.isDone };
  },
});
