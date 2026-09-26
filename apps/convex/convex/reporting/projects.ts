import { query } from "../_generated/server";
import { pageArgs, pageBudget, scopeAccess, inRange, pageResult, matchingRows } from "./scope";
export const page = query({
  args: pageArgs,
  handler: async (ctx, { scope, paginationOpts }) => {
    const { visibleProject } = await scopeAccess(ctx, scope);
    const result = await ctx.db
      .query("projects")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", scope.workspaceId))
      .paginate(pageBudget(paginationOpts));
    const visible = await matchingRows(
      result.page,
      async (item) => inRange(item._creationTime, scope) && (await visibleProject(item._id))
    );
    const projects = await Promise.all(
      visible.map(async (item) => {
        const profile = await ctx.db
          .query("projectProfiles")
          .withIndex("by_project", (q) => q.eq("projectId", item._id))
          .unique();
        return {
          id: item._id,
          name: item.name,
          identifier: item.identifier,
          health: profile && !profile.deleted ? profile.health : "not_assessed",
        };
      })
    );
    return pageResult(result, { count: projects.length, projects });
  },
});
