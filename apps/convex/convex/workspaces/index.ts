import { requireUnrestrictedAccount } from "../identity/deactivation/access";
import { v, ConvexError, type Infer } from "convex/values";
import { query, mutation } from "../_generated/server";
import { role } from "../schema";
import type { MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { requireUser, requireWorkspace, requireAnotherProjectAdmin } from "../identity/access";
export const list = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const members = await ctx.db
      .query("workspaceMembers")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    const workspaces = await Promise.all(
      members
        .filter((m) => m.active)
        .map(async (membership) => {
          const workspace = await ctx.db.get(membership.workspaceId);
          return workspace ? Object.assign(workspace, { membershipRole: membership.role }) : null;
        })
    );
    return workspaces.filter((w) => w !== null);
  },
});
export const create = mutation({
  args: { name: v.string(), slug: v.string() },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const name = args.name.trim();
    if (!name || name.length > 120 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(args.slug) || args.slug.length > 80)
      throw new ConvexError("Enter a workspace name and a valid slug.");
    if (
      await ctx.db
        .query("workspaces")
        .withIndex("by_slug", (q) => q.eq("slug", args.slug))
        .unique()
    )
      throw new ConvexError("This workspace slug is already taken.");
    const workspaceId = await ctx.db.insert("workspaces", { name, slug: args.slug });
    await ctx.db.insert("workspaceMembers", { workspaceId, userId: user._id, role: "admin", active: true });
    return workspaceId;
  },
});

export const resolveMember = query({
  args: { workspaceId: v.id("workspaces"), userId: v.string() },
  handler: async (ctx, args) => {
    const { member } = await requireWorkspace(ctx, args.workspaceId, true);
    if (member.role !== "admin") throw new ConvexError("Only workspace administrators can manage members.");
    const userId = ctx.db.normalizeId("users", args.userId);
    const user = userId ? await ctx.db.get(userId) : null;
    if (!user) throw new ConvexError("User not found.");
    return { id: user._id, name: user.name ?? null, email: user.email ?? null };
  },
});

export async function requireAnotherAdmin(ctx: MutationCtx, workspaceId: Id<"workspaces">) {
  const admins = await ctx.db
    .query("workspaceMembers")
    .withIndex("by_workspace_role_active", (q) =>
      q.eq("workspaceId", workspaceId).eq("role", "admin").eq("active", true)
    )
    .take(2);
  if (admins.length < 2) throw new ConvexError("Assign another workspace administrator first.");
}

export const grantMember = mutation({
  args: { workspaceId: v.id("workspaces"), userId: v.id("users"), role },
  handler: async (ctx, args) => {
    const access = await requireWorkspace(ctx, args.workspaceId, true);
    if (access.member.role !== "admin") throw new ConvexError("Only workspace administrators can manage members.");
    return grantWorkspaceMembership(ctx, args);
  },
});

export const revokeMember = mutation({
  args: { workspaceId: v.id("workspaces"), userId: v.id("users") },
  handler: async (ctx, args) => {
    const access = await requireWorkspace(ctx, args.workspaceId, true);
    if (access.member.role !== "admin") throw new ConvexError("Only workspace administrators can manage members.");
    const existing = await ctx.db
      .query("workspaceMembers")
      .withIndex("by_workspace_user", (q) => q.eq("workspaceId", args.workspaceId).eq("userId", args.userId))
      .unique();
    if (!existing?.active) return;
    if (existing.role === "admin") await requireAnotherAdmin(ctx, args.workspaceId);
    await restrictProjectMemberships(ctx, args.workspaceId, args.userId, "revoke");
    await ctx.db.patch(existing._id, { active: false });
  },
});

async function restrictProjectMemberships(
  ctx: MutationCtx,
  workspaceId: Id<"workspaces">,
  userId: Id<"users">,
  restriction: "revoke" | "guest"
) {
  const memberships = await ctx.db
    .query("projectMembers")
    .withIndex("by_workspace_user", (q) => q.eq("workspaceId", workspaceId).eq("userId", userId))
    .collect();
  const activeMemberships = memberships.filter((member) => member.active);
  await Promise.all(
    activeMemberships
      .filter((member) => member.role === "admin")
      .map(async (member) => {
        const project = await ctx.db.get(member.projectId);
        if (project) await requireAnotherProjectAdmin(ctx, member.projectId);
      })
  );
  await Promise.all(
    activeMemberships.map((member) =>
      ctx.db.patch(member._id, restriction === "revoke" ? { active: false } : { role: "guest" })
    )
  );
}

export async function grantWorkspaceMembership(
  ctx: MutationCtx,
  args: { workspaceId: Id<"workspaces">; userId: Id<"users">; role: Infer<typeof role> }
) {
  await requireUnrestrictedAccount(ctx, args.userId);
  if (!(await ctx.db.get(args.userId))) throw new ConvexError("User not found.");
  const existing = await ctx.db
    .query("workspaceMembers")
    .withIndex("by_workspace_user", (q) => q.eq("workspaceId", args.workspaceId).eq("userId", args.userId))
    .unique();
  if (existing?.active && existing.role === "admin" && args.role !== "admin") {
    await requireAnotherAdmin(ctx, args.workspaceId);
  }
  if (existing) {
    if (existing.active && args.role === "guest")
      await restrictProjectMemberships(ctx, args.workspaceId, args.userId, "guest");
    await ctx.db.patch(existing._id, { role: args.role, active: true });
    return existing._id;
  }
  return ctx.db.insert("workspaceMembers", { ...args, active: true });
}
