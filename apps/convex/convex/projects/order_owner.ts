import { ConvexError } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

export function projectUserProperty(ctx: QueryCtx, projectId: Id<"projects">, userId: Id<"users">) {
  return ctx.db
    .query("projectUserProperties")
    .withIndex("by_project_user", (q) => q.eq("projectId", projectId).eq("userId", userId))
    .unique();
}
export async function initializeProjectOrder(
  ctx: MutationCtx,
  scope: { workspaceId: Id<"workspaces">; projectId: Id<"projects">; userId: Id<"users"> }
) {
  const existing = await projectUserProperty(ctx, scope.projectId, scope.userId);
  if (existing) {
    if (existing.workspaceId !== scope.workspaceId) throw new ConvexError("Project order scope is inconsistent.");
    return false;
  }
  const first = await ctx.db
    .query("projectUserProperties")
    .withIndex("by_owner_order", (q) => q.eq("workspaceId", scope.workspaceId).eq("userId", scope.userId))
    .first();
  const sortOrder = first ? first.sortOrder - 10000 : 65535;
  if (!Number.isSafeInteger(sortOrder)) throw new ConvexError("Project ordering has reached its numeric limit.");
  await ctx.db.insert("projectUserProperties", { ...scope, sortOrder, revision: 0 });
  return true;
}
export async function visibleOrderedProject(ctx: QueryCtx, row: Doc<"projectUserProperties">) {
  const member = await ctx.db
    .query("projectMembers")
    .withIndex("by_project_user", (q) => q.eq("projectId", row.projectId).eq("userId", row.userId))
    .unique();
  if (!member?.active || member.workspaceId !== row.workspaceId) return null;
  const project = await ctx.db.get(row.projectId);
  if (!project || project.archived || project.deletedAt != null || project.workspaceId !== row.workspaceId) return null;
  return { project, member };
}

export async function requireDistinctOrder(ctx: QueryCtx, row: Doc<"projectUserProperties">) {
  const duplicates = await ctx.db
    .query("projectUserProperties")
    .withIndex("by_owner_order", (q) =>
      q.eq("workspaceId", row.workspaceId).eq("userId", row.userId).eq("sortOrder", row.sortOrder)
    )
    .take(2);
  if (!Number.isSafeInteger(row.sortOrder) || duplicates.length !== 1)
    throw new ConvexError("Project order is inconsistent. Repair duplicate or invalid positions before moving.");
}

export const MAX_NEIGHBOR_SCAN = 200;
export async function nearestProjectOrder(ctx: QueryCtx, current: Doc<"projectUserProperties">, up: boolean) {
  const candidates = await ctx.db
    .query("projectUserProperties")
    .withIndex("by_owner_order", (q) => {
      const owner = q.eq("workspaceId", current.workspaceId).eq("userId", current.userId);
      return up ? owner.lt("sortOrder", current.sortOrder) : owner.gt("sortOrder", current.sortOrder);
    })
    .order(up ? "desc" : "asc")
    .take(MAX_NEIGHBOR_SCAN + 1);
  for (const candidate of candidates.slice(0, MAX_NEIGHBOR_SCAN)) {
    // Stop at the nearest authorized row instead of reading every later project.
    // oxlint-disable-next-line no-await-in-loop
    if (await visibleOrderedProject(ctx, candidate)) return candidate;
  }
  if (candidates.length > MAX_NEIGHBOR_SCAN)
    throw new ConvexError("Too many unavailable projects to determine the next position.");
  throw new ConvexError("This project is already at the boundary.");
}
