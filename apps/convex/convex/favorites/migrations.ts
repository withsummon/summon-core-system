import { v } from "convex/values";
import { internalMutation } from "../_generated/server";
// Run while old saved-view favorite writers remain canonical, then rerun under
// a write freeze immediately before switching all readers/writers together.
export const backfill = internalMutation({
  args: { cursor: v.union(v.string(), v.null()) },
  handler: async (ctx, args) => {
    const result = await ctx.db
      .query("savedViewFavorites")
      .paginate({ cursor: args.cursor, numItems: 100, maximumRowsRead: 100, maximumBytesRead: 1024 * 1024 });
    let inserted = 0;
    let relinked = 0;
    for (const source of result.page) {
      // eslint-disable-next-line no-await-in-loop
      const existing = await ctx.db
        .query("favorites")
        .withIndex("by_legacy_source", (q) => q.eq("legacySourceId", source._id))
        .unique();
      if (existing) continue;
      // An old flag can be removed and recreated between online passes.
      // Reuse its migrated target row rather than transiently duplicating it.
      // eslint-disable-next-line no-await-in-loop
      const sameTarget = await ctx.db
        .query("favorites")
        .withIndex("by_owner_target", (q) =>
          q.eq("workspaceId", source.workspaceId).eq("userId", source.userId).eq("targetKey", `view:${source.viewId}`)
        )
        .unique();
      if (sameTarget) {
        // eslint-disable-next-line no-await-in-loop
        await ctx.db.patch(sameTarget._id, {
          legacySourceId: source._id,
          sequence: source._creationTime,
          favoritedAt: source._creationTime,
        });
        relinked++;
        continue;
      }
      // eslint-disable-next-line no-await-in-loop
      await ctx.db.insert("favorites", {
        workspaceId: source.workspaceId,
        userId: source.userId,
        target: { type: "view", id: source.viewId },
        targetType: "view",
        targetProjectId: source.projectId,
        targetKey: `view:${source.viewId}`,
        parentId: null,
        name: null,
        sequence: source._creationTime,
        height: 1,
        favoritedAt: source._creationTime,
        updatedAt: Date.now(),
        deletedAt: null,
        legacySourceId: source._id,
      });
      inserted++;
    }
    return {
      continueCursor: result.continueCursor,
      isDone: result.isDone,
      processed: result.page.length,
      inserted,
      relinked,
    };
  },
});
export const reconcile = internalMutation({
  args: { cursor: v.union(v.string(), v.null()) },
  handler: async (ctx, args) => {
    const result = await ctx.db
      .query("favorites")
      .paginate({ cursor: args.cursor, numItems: 100, maximumRowsRead: 100, maximumBytesRead: 1024 * 1024 });
    let removed = 0;
    for (const row of result.page) {
      if (!row.legacySourceId) continue;
      // eslint-disable-next-line no-await-in-loop
      const source = await ctx.db.get(row.legacySourceId);
      if (!source) {
        // Migration-only rows have no new public writer until cutover.
        // eslint-disable-next-line no-await-in-loop
        await ctx.db.delete(row._id);
        removed++;
      }
    }
    return { continueCursor: result.continueCursor, isDone: result.isDone, processed: result.page.length, removed };
  },
});
