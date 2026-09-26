import { v, ConvexError } from "convex/values";
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
    const { user, member } = await requireWorkspace(ctx, args.workspaceId, true);
    if (member.role !== "admin") throw new ConvexError("Only workspace administrators can create projects.");
    const name = args.name.trim();
    const identifier = args.identifier.trim().toUpperCase();
    if (!name || name.length > 120 || !/^[A-Z][A-Z0-9]{1,9}$/.test(identifier))
      throw new ConvexError("Enter a project name and a 2–10 character identifier.");
    if (
      await ctx.db
        .query("projects")
        .withIndex("by_workspace_identifier", (q) => q.eq("workspaceId", args.workspaceId).eq("identifier", identifier))
        .unique()
    )
      throw new ConvexError("This project identifier is already taken.");
    const projectId = await ctx.db.insert("projects", {
      workspaceId: args.workspaceId,
      name,
      identifier,
      nextSequence: 1,
      archived: false,
    });
    await ctx.db.insert("projectMembers", {
      workspaceId: args.workspaceId,
      projectId,
      userId: user._id,
      role: "admin",
      active: true,
    });
    return projectId;
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
    const workspaceMember = await ctx.db
      .query("workspaceMembers")
      .withIndex("by_workspace_user", (q) => q.eq("workspaceId", access.project.workspaceId).eq("userId", args.userId))
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
    return ctx.db.insert("projectMembers", { ...args, workspaceId: access.project.workspaceId, active: true });
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
