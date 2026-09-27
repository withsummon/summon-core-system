import { ConvexError, v } from "convex/values";
import { internalMutation } from "../_generated/server";
export const workspace = internalMutation({
  args: { cursor: v.union(v.string(), v.null()) },
  handler: async (ctx, args) => {
    const page = await ctx.db
      .query("taskRelations")
      .paginate({ cursor: args.cursor, numItems: 100, maximumRowsRead: 100, maximumBytesRead: 1024 * 1024 });
    let changed = 0;
    for (const row of page.page) {
      const [from, to, project] = await Promise.all([
        ctx.db.get(row.fromId),
        ctx.db.get(row.toId),
        ctx.db.get(row.projectId),
      ]);
      if (!from || !to || !project || from.workspaceId !== to.workspaceId || from.workspaceId !== project.workspaceId)
        throw new ConvexError("Relation endpoints do not share their originating workspace.");
      if (row.workspaceId !== undefined && row.workspaceId !== from.workspaceId)
        throw new ConvexError("Relation workspace ownership is inconsistent.");
      if (row.workspaceId === undefined) {
        await ctx.db.patch(row._id, { workspaceId: from.workspaceId });
        changed++;
      }
    }
    return { processed: page.page.length, changed, isDone: page.isDone, continueCursor: page.continueCursor };
  },
});
