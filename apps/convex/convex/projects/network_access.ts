import { ConvexError } from "convex/values";
import type { QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { requireWorkspace } from "../identity/access";
import type { ProjectNetwork } from "./network_schema";
// Temporary stored-data transition: existing native projects were membership-only.
// Backfill preserves that privacy, rather than silently disclosing them as public.
export function storedNetwork(project: Doc<"projects">) {
  return project.network ?? 0;
}
export async function requireNetworkScope(ctx: QueryCtx, projectId: Id<"projects">, allowArchived = false) {
  const project = await ctx.db.get(projectId);
  if (!project || (!allowArchived && project.archived) || project.deletedAt != null)
    throw new ConvexError("Project not found.");
  const access = await requireWorkspace(ctx, project.workspaceId);
  const membership = await ctx.db
    .query("projectMembers")
    .withIndex("by_project_user", (q) => q.eq("projectId", projectId).eq("userId", access.user._id))
    .unique();
  return { ...access, project, membership };
}
export function canDiscover(network: ProjectNetwork, role: string, joined: boolean) {
  return joined || role === "admin" || (role === "member" && network === 2);
}
export async function requireProjectDiscovery(ctx: QueryCtx, projectId: Id<"projects">) {
  const access = await requireNetworkScope(ctx, projectId, true);
  if (!canDiscover(storedNetwork(access.project), access.member.role, access.membership?.active === true))
    throw new ConvexError("Project not found.");
  return access;
}
