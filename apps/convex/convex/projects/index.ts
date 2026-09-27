import { requireUnrestrictedAccount } from "../identity/deactivation/access";
import type { MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { createProject } from "./create";
import { v, ConvexError, type Infer } from "convex/values";
import { query, mutation } from "../_generated/server";
import { role } from "../schema";
import { requireWorkspace, requireProject, requireAnotherProjectAdmin } from "../identity/access";
export const list = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    const { user, member } = await requireWorkspace(ctx, args.workspaceId);
    const memberships = await ctx.db
      .query("projectMembers")
      .withIndex("by_workspace_user", (q) => q.eq("workspaceId", args.workspaceId).eq("userId", user._id))
      .collect();
    const projects = await Promise.all(
      memberships
        .filter((m) => m.active)
        .map(async (membership) => {
          const project = await ctx.db.get(membership.projectId);
          return project
            ? Object.assign(project, { membershipRole: membership.role, workspaceRole: member.role })
            : null;
        })
    );
    return projects.filter((p) => p !== null).filter((p) => !p.archived);
  },
});
export const create = mutation({
  args: { workspaceId: v.id("workspaces"), name: v.string(), identifier: v.string() },
  handler: async (ctx, args) => {
    return createProject(ctx, args);
  },
});

export const resolveMember = query({
  args: { projectId: v.id("projects"), userId: v.string() },
  handler: async (ctx, args) => {
    const access = await requireProject(ctx, args.projectId, true);
    if (access.projectMember.role !== "admin") throw new ConvexError("Only project administrators can manage members.");
    const userId = ctx.db.normalizeId("users", args.userId);
    if (!userId) throw new ConvexError("User not found.");
    const membership = await ctx.db
      .query("workspaceMembers")
      .withIndex("by_workspace_user", (q) => q.eq("workspaceId", access.project.workspaceId).eq("userId", userId))
      .unique();
    if (!membership?.active) throw new ConvexError("An active member of this workspace is required.");
    const user = await ctx.db.get(userId);
    if (!user) throw new ConvexError("User not found.");
    return { id: user._id, name: user.name ?? null, email: user.email ?? null };
  },
});

export const grantMember = mutation({
  args: { projectId: v.id("projects"), userId: v.id("users"), role },
  handler: async (ctx, args) => {
    const access = await requireProject(ctx, args.projectId, true);
    if (access.projectMember.role !== "admin") throw new ConvexError("Only project administrators can manage members.");
    return grantProjectMembership(ctx, { ...args, workspaceId: access.project.workspaceId });
  },
});

export const revokeMember = mutation({
  args: { projectId: v.id("projects"), userId: v.id("users") },
  handler: async (ctx, args) => {
    const access = await requireProject(ctx, args.projectId, true);
    if (access.projectMember.role !== "admin") throw new ConvexError("Only project administrators can manage members.");
    const existing = await ctx.db
      .query("projectMembers")
      .withIndex("by_project_user", (q) => q.eq("projectId", args.projectId).eq("userId", args.userId))
      .unique();
    if (!existing?.active) return;
    if (existing.role === "admin") await requireAnotherProjectAdmin(ctx, args.projectId);
    await ctx.db.patch(existing._id, { active: false });
  },
});

export async function grantProjectMembership(
  ctx: MutationCtx,
  args: {
    workspaceId: Id<"workspaces">;
    projectId: Id<"projects">;
    userId: Id<"users">;
    role: Infer<typeof role>;
  }
) {
  await requireUnrestrictedAccount(ctx, args.userId);
  const { workspaceId, ...membership } = args;
  const workspaceMember = await ctx.db
    .query("workspaceMembers")
    .withIndex("by_workspace_user", (q) => q.eq("workspaceId", workspaceId).eq("userId", args.userId))
    .unique();
  if (!workspaceMember?.active) throw new ConvexError("An active member of this workspace is required.");
  if (workspaceMember.role === "guest" && args.role !== "guest")
    throw new ConvexError("Workspace guests can only receive guest project access.");
  const existing = await ctx.db
    .query("projectMembers")
    .withIndex("by_project_user", (q) => q.eq("projectId", args.projectId).eq("userId", args.userId))
    .unique();
  if (existing?.active && existing.role === "admin" && args.role !== "admin") {
    await requireAnotherProjectAdmin(ctx, args.projectId);
  }
  if (existing) {
    await ctx.db.patch(existing._id, { role: args.role, active: true });
    return existing._id;
  }
  return ctx.db.insert("projectMembers", { ...membership, workspaceId, active: true });
}
