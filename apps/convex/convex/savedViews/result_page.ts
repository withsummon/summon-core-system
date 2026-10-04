import type { PaginationOptions } from "convex/server";
import { stream } from "convex-helpers/server/stream";
import schema from "../schema";
import type { QueryCtx } from "../_generated/server";
import type { Doc } from "../_generated/dataModel";
import type { requireWorkspace } from "../identity/access";
import { pageBudget } from "../commercial/validation";
import { taskDetail, taskIsActive, taskOrdering, taskRoleCanRead } from "../tasks/access";
import { matchesFilters } from "./filters";
import { projectReader, projectSummary } from "./scope";
export async function resultPage(
  ctx: QueryCtx,
  view: Doc<"savedViews">,
  access: Awaited<ReturnType<typeof requireWorkspace>>,
  paginationOpts: PaginationOptions,
  criteria: Pick<Doc<"savedViews">, "filters" | "displayFilters"> = view
) {
  const projectId = view.projectId;
  const { workspace, user, member } = access;
  const display = criteria.displayFilters;
  const ordering = taskOrdering[display.order];
  const tasks = stream(ctx.db, schema).query("tasks");
  const source =
    projectId !== null && display.order === "createdAt"
      ? tasks.withIndex("by_project", (q) => q.eq("projectId", projectId))
      : projectId !== null && display.order === "updatedAt"
        ? tasks.withIndex("by_project_updated", (q) => q.eq("projectId", projectId))
        : tasks.withIndex(ordering.index, (q) => q.eq("workspaceId", workspace._id));
  const read = projectReader(ctx, workspace._id, user._id);
  const result = await source
    .order(ordering.direction)
    .map(async (task) => {
      if (
        task.workspaceId !== workspace._id ||
        (projectId !== null && task.projectId !== projectId) ||
        !taskIsActive(task) ||
        !matchesFilters(task, criteria.filters)
      )
        return null;
      const permission = await read(task.projectId);
      if (!permission) return null;
      if (
        !taskRoleCanRead(task, user._id, member.role, permission.member.role, !!permission.project.guestViewAllFeatures)
      )
        return null;
      if (
        !display.includeSubtasks &&
        (await ctx.db
          .query("taskParents")
          .withIndex("by_child", (q) => q.eq("childId", task._id))
          .unique())
      )
        return null;
      return {
        task: await taskDetail(ctx, task, { ...access, project: permission.project, projectMember: permission.member }),
        project: projectSummary(permission.project),
        state: task.stateId ? await ctx.db.get(task.stateId) : null,
      };
    })
    .paginate(pageBudget(paginationOpts));
  return { ...result, viewUpdatedAt: view.updatedAt };
}
