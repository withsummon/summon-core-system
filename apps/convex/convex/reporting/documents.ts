import { query } from "../_generated/server";
import { canAccessDocument } from "../documents/access";
import { pageArgs, pageBudget, scopeAccess, inRange, pageResult, matchingRows } from "./scope";
export const page = query({
  args: pageArgs,
  handler: async (ctx, { scope, paginationOpts }) => {
    const { user, visibleProject } = await scopeAccess(ctx, scope);
    const result = await ctx.db
      .query("documents")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", scope.workspaceId).eq("deleted", false))
      .paginate(pageBudget(paginationOpts));
    const rows = await matchingRows(result.page, async (document) => {
      if (!inRange(document._creationTime, scope) || !(await canAccessDocument(ctx, document, user._id))) return false;
      if (scope.projectId || scope.clientId)
        return (await Promise.all(document.projectIds.map(visibleProject))).some(Boolean);
      return true;
    });
    return pageResult(result, { count: rows.length });
  },
});
