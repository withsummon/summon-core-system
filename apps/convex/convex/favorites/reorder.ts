import type { QueryCtx } from "../_generated/server";
import type { Doc } from "../_generated/dataModel";
import { ConvexError, v } from "convex/values";
import { mutation } from "../_generated/server";
import { ownFavorite, effectiveFavorite, favoriteRemoved, revision } from "./access";
import { visibleTarget } from "./targets";
export const move = mutation({
  args: {
    favoriteId: v.id("favorites"),
    expectedUpdatedAt: v.number(),
    direction: v.union(v.literal("up"), v.literal("down")),
  },
  handler: async (ctx, args) => {
    const { row, member } = await ownFavorite(ctx, args.favoriteId);
    const updatedAt = revision(row, args.expectedUpdatedAt);
    if (!(await effectiveFavorite(ctx, row))) throw new ConvexError("Restore the favorite folder first.");
    if (!(await visibleTarget(ctx, row.target, member))?.canFavorite)
      throw new ConvexError("Favorite target is unavailable.");
    await requireDistinctSequence(ctx, row);
    const query = ctx.db
      .query("favorites")
      .withIndex("by_owner_parent_order", (q) => {
        const siblings = q.eq("workspaceId", row.workspaceId).eq("userId", row.userId).eq("parentId", row.parentId);
        return args.direction === "up" ? siblings.gt("sequence", row.sequence) : siblings.lt("sequence", row.sequence);
      })
      .order(args.direction === "up" ? "asc" : "desc");
    const result = await query.paginate({
      cursor: null,
      numItems: 100,
      maximumRowsRead: 100,
      maximumBytesRead: 1024 * 1024,
    });
    for (const neighbor of result.page) {
      if (neighbor.deletedAt !== null) continue;
      // Stop at the closest visible sibling; no hidden target data is returned.
      // eslint-disable-next-line no-await-in-loop
      if (!(await visibleTarget(ctx, neighbor.target, member)) || (await favoriteRemoved(ctx, neighbor))) continue;
      // eslint-disable-next-line no-await-in-loop
      await requireDistinctSequence(ctx, neighbor);
      // eslint-disable-next-line no-await-in-loop
      await ctx.db.patch(row._id, { sequence: neighbor.sequence, updatedAt });
      // eslint-disable-next-line no-await-in-loop
      await ctx.db.patch(neighbor._id, {
        sequence: row.sequence,
        updatedAt: Math.max(Date.now(), neighbor.updatedAt + 1),
      });
      return { moved: true };
    }
    if (!result.isDone)
      throw new ConvexError("No visible neighbor within 100 positions. Change the explicit order or folder instead.");
    return { moved: false };
  },
});

async function requireDistinctSequence(ctx: QueryCtx, row: Doc<"favorites">) {
  const tied = await ctx.db
    .query("favorites")
    .withIndex("by_owner_parent_order", (q) =>
      q
        .eq("workspaceId", row.workspaceId)
        .eq("userId", row.userId)
        .eq("parentId", row.parentId)
        .eq("sequence", row.sequence)
    )
    .take(2);
  if (tied.length > 1) throw new ConvexError("Favorites share an order value. Assign a distinct order before moving.");
}
