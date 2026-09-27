import { ConvexError, v } from "convex/values";
import { internalMutation } from "../_generated/server";
export const workspaceScopes = internalMutation({
  args: { table: v.union(v.literal("views"), v.literal("favorites")), cursor: v.union(v.string(), v.null()) },
  handler: async (ctx, args) => {
    const table = args.table === "views" ? "savedViews" : "savedViewFavorites";
    const result = await ctx.db
      .query(table)
      .paginate({ cursor: args.cursor, numItems: 50, maximumRowsRead: 50, maximumBytesRead: 1048576 });
    const pending = result.page.filter((row) => row.workspaceId === undefined);
    await Promise.all(
      pending.map(async (row) => {
        if (!row.projectId) throw new ConvexError("A workspace-only saved view row has no workspace owner.");
        const project = await ctx.db.get(row.projectId);
        if (!project) throw new ConvexError("Saved view project is missing; resolve its ownership before migration.");
        await ctx.db.patch(row._id, { workspaceId: project.workspaceId });
      })
    );
    const changed = pending.length;
    return { changed, isDone: result.isDone, continueCursor: result.continueCursor };
  },
});
