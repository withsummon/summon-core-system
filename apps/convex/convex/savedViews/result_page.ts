import type { PaginationOptions } from "convex/server";
import type { QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { pageBudget } from "../commercial/validation";
import { taskIsActive } from "../tasks/access";
import { matchesFilters } from "./filters";
import { projectReader, projectSummary } from "./scope";
export async function resultPage(
  ctx: QueryCtx,
  view: Doc<"savedViews">,
  workspaceId: Id<"workspaces">,
  userId: Id<"users">,
  workspaceGuest: boolean,
  paginationOpts: PaginationOptions
) {
  const projectId = view.projectId;
  const source =
    projectId === null
      ? ctx.db.query("tasks").withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      : ctx.db.query("tasks").withIndex("by_project", (q) => q.eq("projectId", projectId));
  const result = await source.order("desc").paginate(pageBudget(paginationOpts));
  const read = projectReader(ctx, workspaceId, userId);
  const page = await Promise.all(
    result.page.map(async (task) => {
      if (!taskIsActive(task) || !matchesFilters(task, view.filters)) return null;
      const permission = await read(task.projectId);
      if (!permission) return null;
      const guest = workspaceGuest || permission.member.role === "guest";
      if (guest && !permission.project.guestViewAllFeatures && task.createdBy !== userId) return null;
      return { task, project: projectSummary(permission.project) };
    })
  );
  return { ...result, page: page.filter((row) => row !== null), viewUpdatedAt: view.updatedAt };
}
