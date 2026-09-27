import { requireUser } from "../identity/access";
import { taskCanRead } from "../tasks/access";
import { taskIsActive } from "../tasks/access";
import { query } from "../_generated/server";
import { pageArgs, pageBudget, scopeAccess, inRange, pageResult, matchingRows } from "./scope";

export const page = query({
  args: pageArgs,
  handler: async (ctx, { scope, paginationOpts }) => {
    const user = await requireUser(ctx);
    const { visibleProject } = await scopeAccess(ctx, scope);
    const source = scope.projectId
      ? ctx.db.query("tasks").withIndex("by_project", (q) => q.eq("projectId", scope.projectId!))
      : ctx.db.query("tasks").withIndex("by_workspace", (q) => q.eq("workspaceId", scope.workspaceId));
    const result = await source.paginate(pageBudget(paginationOpts));
    const counts = {
      total: 0,
      completed: 0,
      overdue: 0,
      dueInSevenDays: 0,
      later: 0,
      noDueDate: 0,
    };
    const completionTrend: Record<string, number> = {};
    const sevenDays = new Date(Date.parse(scope.today) + 7 * 86400000).toISOString().slice(0, 10);
    const rows = await matchingRows(
      result.page,
      async (task) =>
        taskIsActive(task) &&
        (await taskCanRead(ctx, task, user._id)) &&
        inRange(task._creationTime, scope) &&
        (await visibleProject(task.projectId))
    );
    for (const task of rows) {
      counts.total++;
      if (task.status === "done") {
        counts.completed++;
        if (task.completedAt !== null) {
          const day = new Date(task.completedAt).toISOString().slice(0, 10);
          completionTrend[day] = (completionTrend[day] ?? 0) + 1;
        }
      } else if (task.status !== "cancelled") {
        if (!task.targetDate) counts.noDueDate++;
        else if (task.targetDate < scope.today) counts.overdue++;
        else if (task.targetDate <= sevenDays) counts.dueInSevenDays++;
        else counts.later++;
      }
    }
    return pageResult(result, { ...counts, completionTrend });
  },
});
