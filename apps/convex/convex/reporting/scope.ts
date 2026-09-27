import { paginationOptsValidator, type PaginationOptions } from "convex/server";
import { ConvexError, v, type Infer } from "convex/values";
import type { QueryCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { requireProject, requireWorkspace } from "../identity/access";
import { date, requireClient } from "../commercial/validation";

export const reportScope = v.object({
  workspaceId: v.id("workspaces"),
  projectId: v.union(v.id("projects"), v.null()),
  clientId: v.union(v.id("clients"), v.null()),
  dateFrom: v.union(v.string(), v.null()),
  dateTo: v.union(v.string(), v.null()),
  today: v.string(),
});
export const pageArgs = { scope: reportScope, paginationOpts: paginationOptsValidator };
export type ReportScope = Infer<typeof reportScope>;
export function pageBudget(options: PaginationOptions) {
  if (!Number.isSafeInteger(options.numItems) || options.numItems < 1 || options.numItems > 100)
    throw new ConvexError("Request 1–100 report rows per page.");
  return { ...options, maximumRowsRead: 100, maximumBytesRead: 1_048_576 };
}
export async function scopeAccess(ctx: QueryCtx, scope: ReportScope) {
  const access = await requireWorkspace(ctx, scope.workspaceId);
  date(scope.dateFrom);
  date(scope.dateTo);
  date(scope.today);
  if (scope.dateFrom && scope.dateTo && scope.dateFrom > scope.dateTo) throw new ConvexError("Date range is reversed.");
  if (scope.projectId) {
    const { project } = await requireProject(ctx, scope.projectId);
    if (project.workspaceId !== scope.workspaceId) throw new ConvexError("Project belongs to another workspace.");
  }
  if (scope.clientId) await requireClient(ctx, scope.workspaceId, scope.clientId);
  // Cache only projects actually referenced by this page. No all-project scan.
  const projects = new Map<Id<"projects">, Promise<boolean>>();
  const visibleProject = (projectId: Id<"projects">) => {
    let pending = projects.get(projectId);
    if (!pending) {
      pending = (async () => {
        if (scope.projectId && scope.projectId !== projectId) return false;
        const project = await ctx.db.get(projectId);
        if (!project || project.archived || project.deletedAt != null || project.workspaceId !== scope.workspaceId)
          return false;
        const membership = await ctx.db
          .query("projectMembers")
          .withIndex("by_project_user", (q) => q.eq("projectId", projectId).eq("userId", access.user._id))
          .unique();
        if (!membership?.active) return false;
        if (!scope.clientId) return true;
        const profile = await ctx.db
          .query("projectProfiles")
          .withIndex("by_project", (q) => q.eq("projectId", projectId))
          .unique();
        return Boolean(profile && !profile.deleted && profile.clientId === scope.clientId);
      })();
      projects.set(projectId, pending);
    }
    return pending;
  };
  return { ...access, visibleProject };
}
export function inRange(timestamp: number, scope: ReportScope) {
  const day = new Date(timestamp).toISOString().slice(0, 10);
  return (!scope.dateFrom || day >= scope.dateFrom) && (!scope.dateTo || day <= scope.dateTo);
}
export function pageResult<T>(result: { continueCursor: string; isDone: boolean }, contribution: T) {
  return { contribution, continueCursor: result.continueCursor, isDone: result.isDone, coverage: "page" as const };
}

export async function matchingRows<T>(rows: T[], matches: (row: T) => Promise<boolean>) {
  const accepted = await Promise.all(rows.map(matches));
  return rows.filter((_row, index) => accepted[index]);
}
