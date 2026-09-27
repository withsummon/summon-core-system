import { requireIdentity } from "./session";
import { internal } from "../_generated/api";
import { requireUnrestrictedAccount } from "./deactivation/access";
import { ConvexError } from "convex/values";
import type { QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";

export async function requireUser(ctx: QueryCtx): Promise<Doc<"users">> {
  if (process.env.SUMMON_AUTH_ENGINE !== "better-auth") return (await requireIdentity(ctx)).user;
  const authUser = await ctx.runQuery(internal.better_auth.sessionUser, {});
  if (!authUser?.emailVerified)
    throw new ConvexError({ code: "SESSION_EXPIRED", message: "Sign in again. Your session expired or was revoked." });
  const link = await ctx.db
    .query("betterAuthLinks")
    .withIndex("by_auth_id", (q) => q.eq("authId", authUser.id))
    .unique();
  const user = link && (await ctx.db.get(link.userId));
  if (!user || user.email !== authUser.email || user.emailVerificationTime === undefined)
    throw new ConvexError("Your account is unavailable.");
  await requireUnrestrictedAccount(ctx, user._id);
  return user;
}
export async function requireWorkspace(ctx: QueryCtx, workspaceId: Id<"workspaces">, write = false) {
  const user = await requireUser(ctx);
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
  const project = await ctx.db.get(projectId);
  if (!project || project.archived || project.deletedAt != null) throw new ConvexError("Project not found.");
  return requireProjectMembership(ctx, project, write);
}

// Shared membership owner; only lifecycle recovery may call this for an archived project.
export async function requireProjectMembership(ctx: QueryCtx, project: Doc<"projects">, write = false) {
  if (project.deletedAt != null) throw new ConvexError("Project not found.");
  const projectId = project._id;
  const access = await requireWorkspace(ctx, project.workspaceId, write);
  const member = await ctx.db
    .query("projectMembers")
    .withIndex("by_project_user", (q) => q.eq("projectId", projectId).eq("userId", access.user._id))
    .unique();
  if (!member?.active || (write && member.role === "guest"))
    throw new ConvexError("You do not have access to this project.");
  return { ...access, project, projectMember: member };
}

// Membership writers preserve this invariant before revoking or demoting an administrator.
export async function requireAnotherProjectAdmin(ctx: QueryCtx, projectId: Id<"projects">) {
  const admins = await ctx.db
    .query("projectMembers")
    .withIndex("by_project_role_active", (q) => q.eq("projectId", projectId).eq("role", "admin").eq("active", true))
    .take(2);
  if (admins.length < 2) throw new ConvexError("Assign another project administrator first.");
}
