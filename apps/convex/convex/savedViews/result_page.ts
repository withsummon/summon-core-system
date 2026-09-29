import type { PaginationOptions } from "convex/server";
import { stream } from "convex-helpers/server/stream";
import schema from "../schema";
import type { QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { pageBudget } from "../commercial/validation";
import { taskIsActive, taskRoleCanRead } from "../tasks/access";
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
  const tasks = stream(ctx.db, schema).query("tasks");
  const source =
    projectId === null
      ? tasks.withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      : tasks.withIndex("by_project", (q) => q.eq("projectId", projectId));
  const read = projectReader(ctx, workspaceId, userId);
  const result = await source
    .order("desc")
    .map(async (task) => {
      if (!taskIsActive(task) || !matchesFilters(task, view.filters)) return null;
      const permission = await read(task.projectId);
      if (!permission) return null;
      if (
        !taskRoleCanRead(
          task,
          userId,
          workspaceGuest ? "guest" : "member",
          permission.member.role,
          !!permission.project.guestViewAllFeatures
        )
      )
        return null;
      return {
        task,
        project: projectSummary(permission.project),
        state: task.stateId ? await ctx.db.get(task.stateId) : null,
      };
    })
    .paginate(pageBudget(paginationOpts));
  return { ...result, viewUpdatedAt: view.updatedAt };
}
