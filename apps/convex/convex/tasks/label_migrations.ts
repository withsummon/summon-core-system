import { v } from "convex/values";
import { internalMutation } from "../_generated/server";
export const metadata = internalMutation({
  args: { cursor: v.union(v.string(), v.null()) },
  handler: async (ctx, args) => {
    const result = await ctx.db.query("taskLabels").paginate({ cursor: args.cursor, numItems: 100 });
    let changed = 0;
    for (const row of result.page) {
      if (row.parentId === undefined || row.revision === undefined || row.retiring === undefined) {
        // Each bounded page is updated transactionally; no external work is awaited.
        // oxlint-disable-next-line no-await-in-loop
        await ctx.db.patch(row._id, {
          parentId: row.parentId ?? null,
          revision: row.revision ?? 0,
          retiring: row.retiring ?? false,
        });
        changed++;
      }
    }
    return { cursor: result.continueCursor, isDone: result.isDone, changed };
  },
});
