import { v } from "convex/values";
import { internalMutation } from "../_generated/server";
export const references = internalMutation({
  args: { table: v.union(v.literal("tasks"), v.literal("drafts")), cursor: v.union(v.string(), v.null()) },
  handler: async (ctx, args) => {
    const options = { cursor: args.cursor, numItems: 100, maximumRowsRead: 100, maximumBytesRead: 1_048_576 };
    if (args.table === "tasks") {
      const page = await ctx.db.query("tasks").paginate(options);
      const missing = page.page.filter((task) => task.estimatePointId === undefined);
      await Promise.all(missing.map((task) => ctx.db.patch(task._id, { estimatePointId: null })));
      return { cursor: page.continueCursor, isDone: page.isDone, processed: page.page.length, changed: missing.length };
    }
    const page = await ctx.db.query("taskDrafts").paginate(options);
    const missing = page.page.filter((draft) => draft.properties.estimatePointId === undefined);
    await Promise.all(
      missing.map((draft) => ctx.db.patch(draft._id, { properties: { ...draft.properties, estimatePointId: null } }))
    );
    return { cursor: page.continueCursor, isDone: page.isDone, processed: page.page.length, changed: missing.length };
  },
});
