import { query } from "../_generated/server";
import { pageArgs, pageBudget, scopeAccess, inRange, pageResult, matchingRows } from "./scope";
export const page = query({
  args: pageArgs,
  handler: async (ctx, { scope, paginationOpts }) => {
    const { visibleProject } = await scopeAccess(ctx, scope);
    const result = await ctx.db
      .query("meetings")
      .withIndex("by_workspace_start", (q) => q.eq("workspaceId", scope.workspaceId).eq("deleted", false))
      .paginate(pageBudget(paginationOpts));
    const statuses = { scheduled: 0, completed: 0, cancelled: 0 };
    const trend: Record<string, number> = {};
    const rows = await matchingRows(
      result.page,
      async (meeting) =>
        inRange(meeting.startsAt, scope) &&
        (meeting.projectId ? await visibleProject(meeting.projectId) : !scope.projectId && !scope.clientId)
    );
    for (const meeting of rows) {
      statuses[meeting.status]++;
      const day = new Date(meeting.startsAt).toISOString().slice(0, 10);
      trend[day] = (trend[day] ?? 0) + 1;
    }
    return pageResult(result, {
      statuses,
      trend,
      total: Object.values(statuses).reduce((sum, count) => sum + count, 0),
    });
  },
});
