import { setViewFavorite } from "../favorites/views";
import { effectiveFavorite } from "../favorites/access";
import { ConvexError, v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { stream } from "convex-helpers/server/stream";
import schema from "../schema";
import { mutation, query } from "../_generated/server";
import { requireProject } from "../identity/access";
import { pageBudget } from "../commercial/validation";
import { requireView, capabilities, projectView } from "./access";
export const set = mutation({
  args: { viewId: v.id("savedViews"), favorite: v.boolean() },
  handler: async (ctx, args) => {
    const { view, access, canFavorite } = await requireView(ctx, args.viewId);
    if (!canFavorite) throw new ConvexError("Guests cannot change favorites.");
    await setViewFavorite(ctx, view, access.user._id, args.favorite);
  },
});
export const list = query({
  args: { projectId: v.id("projects"), paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const access = await requireProject(ctx, args.projectId);
    return stream(ctx.db, schema)
      .query("favorites")
      .withIndex("by_owner_type_project", (q) =>
        q
          .eq("workspaceId", access.workspace._id)
          .eq("userId", access.user._id)
          .eq("targetType", "view")
          .eq("targetProjectId", args.projectId)
      )
      .order("desc")
      .map(async (row) => {
        if (row.target.type !== "view" || !(await effectiveFavorite(ctx, row))) return null;
        const view = await ctx.db.get(row.target.id);
        if (!view || view.deletedAt !== null || !capabilities(view, access).canRead) return null;
        return projectView(ctx, view, access);
      })
      .paginate(pageBudget(args.paginationOpts));
  },
});
