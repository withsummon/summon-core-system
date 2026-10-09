import { requireUser } from "./session";
import { ConvexError } from "convex/values";
import type { QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";

export { requireUser } from "./session";
export async function requireWorkspace(ctx: QueryCtx, workspaceId: Id<"workspaces">, write = false) {
  return requireWorkspaceForUser(ctx, workspaceId, await requireUser(ctx), write);
}
export async function requireWorkspaceForUser(
  ctx: QueryCtx,
  workspaceId: Id<"workspaces">,
  user: Doc<"users">,
  write = false
) {
  const member = await ctx.db
    .query("workspaceMembers")
    .withIndex("by_workspace_user", (q) => q.eq("workspaceId", workspaceId).eq("userId", user._id))
    .unique();
  if (!member?.active || (write && member.role === "guest"))
    throw new ConvexError("You do not have access to this workspace.");
  const workspace = await ctx.db.get(workspaceId);
  if (!workspace || workspace.deletedAt != null) throw new ConvexError("Workspace not found.");
  return { user, member, workspace };
}
export async function requireProject(ctx: QueryCtx, projectId: Id<"projects">, write = false) {
  return requireProjectForUser(ctx, projectId, await requireUser(ctx), write);
}
export async function requireProjectForUser(
  ctx: QueryCtx,
  projectId: Id<"projects">,
  user: Doc<"users">,
  write = false
) {
  const project = await ctx.db.get(projectId);
  if (!project || project.archived || project.deletedAt != null) throw new ConvexError("Project not found.");
  return requireProjectMembershipForUser(ctx, project, user, write);
}

// Shared membership owner for archived lifecycle recovery and public asset reads.
export async function requireProjectMembership(ctx: QueryCtx, project: Doc<"projects">, write = false) {
  return requireProjectMembershipForUser(ctx, project, await requireUser(ctx), write);
}
export async function requireProjectMembershipForUser(
  ctx: QueryCtx,
  project: Doc<"projects">,
  user: Doc<"users">,
  write: boolean
) {
  if (project.deletedAt != null) throw new ConvexError("Project not found.");
  const projectId = project._id;
  const access = await requireWorkspaceForUser(ctx, project.workspaceId, user, write);
  const member = await ctx.db
    .query("projectMembers")
    .withIndex("by_project_user", (q) => q.eq("projectId", projectId).eq("userId", access.user._id))
    .unique();
  if (!member?.active || member.workspaceId !== project.workspaceId || (write && member.role === "guest"))
    throw new ConvexError("You do not have access to this project.");
  return { ...access, project, projectMember: member };
}

// Membership writers preserve this invariant before revoking or demoting an administrator.
export async function requireAnotherWorkspaceAdmin(ctx: QueryCtx, workspaceId: Id<"workspaces">) {
  const admins = await ctx.db
    .query("workspaceMembers")
    .withIndex("by_workspace_role_active", (q) =>
      q.eq("workspaceId", workspaceId).eq("role", "admin").eq("active", true)
    )
    .take(2);
  if (admins.length < 2) throw new ConvexError("Assign another workspace administrator first.");
}

export async function requireAnotherProjectAdmin(ctx: QueryCtx, projectId: Id<"projects">) {
  const admins = await ctx.db
    .query("projectMembers")
    .withIndex("by_project_role_active", (q) => q.eq("projectId", projectId).eq("role", "admin").eq("active", true))
    .take(2);
  if (admins.length < 2) throw new ConvexError("Assign another project administrator first.");
}
