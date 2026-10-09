import { ConvexError } from "convex/values";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { requireWorkspace } from "../identity/access";
export async function favoriteAccess(ctx: QueryCtx, workspaceId: Id<"workspaces">) {
  const access = await requireWorkspace(ctx, workspaceId, true);
  return access;
}
export async function ownFavorite(ctx: QueryCtx, id: Id<"favorites">) {
  const row = await ctx.db.get(id);
  if (!row) throw new ConvexError("Favorite not found.");
  const access = await favoriteAccess(ctx, row.workspaceId);
  if (row.userId !== access.user._id) throw new ConvexError("Favorite not found.");
  return { row, ...access };
}
export async function ancestors(
  ctx: QueryCtx,
  row: Pick<Doc<"favorites">, "parentId" | "workspaceId" | "userId">,
  exclude?: Id<"favorites">
) {
  const chain: Doc<"favorites">[] = [];
  let parentId = row.parentId;
  while (parentId) {
    if (chain.length >= 20 || parentId === exclude || chain.some((item) => item._id === parentId))
      throw new ConvexError("Favorite folders cannot cycle or exceed 20 levels.");
    // eslint-disable-next-line no-await-in-loop
    const parent = await ctx.db.get(parentId);
    if (
      !parent ||
      parent.workspaceId !== row.workspaceId ||
      parent.userId !== row.userId ||
      parent.target.type !== "folder"
    )
      throw new ConvexError("Favorite folder not found.");
    chain.push(parent);
    parentId = parent.parentId;
  }
  return chain;
}
export function revision(row: Doc<"favorites">, expected: number) {
  if (!Number.isSafeInteger(expected) || row.updatedAt !== expected)
    throw new ConvexError("Favorite changed. Refresh before trying again.");
  return Math.max(Date.now(), row.updatedAt + 1);
}
// Stored subtree height keeps moves bounded without scanning every descendant.
export async function updateHeights(ctx: MutationCtx, chain: Doc<"favorites">[]) {
  for (const parent of chain) {
    // eslint-disable-next-line no-await-in-loop
    const child = await ctx.db
      .query("favorites")
      .withIndex("by_parent_height", (q) => q.eq("parentId", parent._id))
      .order("desc")
      .first();
    // eslint-disable-next-line no-await-in-loop
    await ctx.db.patch(parent._id, { height: (child?.height ?? 0) + 1 });
  }
}

// Missing revision markers predate adoption of archive cleanup. They are removed
// only after a real archive supplies a cutoff; no historical event is inferred.
export async function favoriteRemoved(ctx: QueryCtx, row: Doc<"favorites">) {
  if (row.deletedAt !== null) return true;
  if (row.targetProjectId === null) return false;
  const project = await ctx.db.get(row.targetProjectId);
  return (
    project?.archivedFavoriteRevision !== undefined &&
    (row.projectRevision === undefined || row.projectRevision < project.archivedFavoriteRevision)
  );
}
export async function effectiveFavorite(ctx: QueryCtx, row: Doc<"favorites"> | null) {
  return (
    !!row &&
    !(await favoriteRemoved(ctx, row)) &&
    !(await ancestors(ctx, row)).some((parent) => parent.deletedAt !== null)
  );
}
export function viewFavorite(
  ctx: QueryCtx,
  workspaceId: Id<"workspaces">,
  userId: Id<"users">,
  viewId: Id<"savedViews">
) {
  return ctx.db
    .query("favorites")
    .withIndex("by_owner_target", (q) =>
      q.eq("workspaceId", workspaceId).eq("userId", userId).eq("targetKey", `view:${viewId}`)
    )
    .unique();
}
