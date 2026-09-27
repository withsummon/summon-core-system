import { ConvexError, v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { mutation, query } from "../_generated/server";
import { requireProject } from "../identity/access";
import { pageBudget } from "../commercial/validation";
import { requireView, capabilities, projectView } from "./access";
export const set = mutation({
  args: { viewId: v.id("savedViews"), favorite: v.boolean() },
  handler: async (ctx, args) => {
    const { canFavorite } = await requireView(ctx, args.viewId);
    if (!canFavorite) throw new ConvexError("Guests cannot change favorites.");
    throw new ConvexError("Favorite migration is in progress. Try again shortly.");
  },
});
export const list = query({
  args: { projectId: v.id("projects"), paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const access = await requireProject(ctx, args.projectId);
    const result = await ctx.db
      .query("savedViewFavorites")
      .withIndex("by_project_user", (q) => q.eq("projectId", args.projectId).eq("userId", access.user._id))
      .order("desc")
      .paginate(pageBudget(args.paginationOpts));
    const page = await Promise.all(
      result.page.map(async (row) => {
        const view = await ctx.db.get(row.viewId);
        if (!view || view.deletedAt !== null || !capabilities(view, access).canRead) return null;
        return projectView(ctx, view, access);
      })
    );
    return { ...result, page: page.filter((row) => row !== null) };
  },
});
