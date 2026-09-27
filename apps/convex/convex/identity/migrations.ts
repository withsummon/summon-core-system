import { v } from "convex/values";
import { internalMutation } from "../_generated/server";
import { defaultPreferences } from "./preferences_fields";
export const preferences = internalMutation({
  args: { cursor: v.union(v.string(), v.null()) },
  handler: async (ctx, args) => {
    const result = await ctx.db
      .query("userProfiles")
      .paginate({ cursor: args.cursor, numItems: 100, maximumRowsRead: 100, maximumBytesRead: 1024 * 1024 });
    const missing = result.page.filter((row) => row.preferences === undefined);
    await Promise.all(missing.map((row) => ctx.db.patch(row._id, { preferences: defaultPreferences })));
    return {
      continueCursor: result.continueCursor,
      isDone: result.isDone,
      processed: result.page.length,
      changed: missing.length,
    };
  },
});
