import { grantProjectMembership, revokeProjectMembership } from "../projects/index";
import { recordWorkspaceCreation } from "../identity/onboarding";
import { selectWorkspaceForUser } from "../identity/preferences";
import { defaultSettings, validateSettings } from "../settings/values";
import { requireWorkspaceCreation } from "../identity/instance/configuration";
import { workspaceLogo } from "../settings/logo_owner";
import { workspaceName, workspaceSlug } from "../settings/metadata";
import { requireUnrestrictedAccount } from "../identity/deactivation/access";
import {
  MAX_MEMBER_DIRECTORY_MEMBERS,
  memberDirectoryOrder,
  profileIdentity,
  sortMemberDirectory,
} from "../identity/profile_owner";
import { personalImageDescriptor, userAppearance } from "../identity/avatar_owner";
import { v, ConvexError, type Infer } from "convex/values";
import { query, mutation } from "../_generated/server";
import { role } from "../schema";
import type { MutationCtx } from "../_generated/server";
import type { Id, Doc } from "../_generated/dataModel";
import { requireUser, requireWorkspace, requireAnotherWorkspaceAdmin } from "../identity/access";
export const list = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const memberships = await ctx.db
      .query("workspaceMembers")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    const workspaces = await Promise.all(
      memberships
        .filter((m) => m.active)
        .map(async (membership) => {
          const workspace = await ctx.db.get(membership.workspaceId);
          return workspace && workspace.deletedAt == null
            ? Object.assign(workspace, {
                membershipRole: membership.role,
                logo: await workspaceLogo(ctx, workspace._id),
              })
            : null;
        })
    );
    return workspaces.filter((w) => w !== null);
  },
});
export const create = mutation({
  args: {
    name: v.string(),
    slug: v.string(),
    organizationSize: v.optional(v.string()),
    onboardingRevision: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    requireWorkspaceCreation();
    const name = workspaceName(args.name);
    const slug = workspaceSlug(args.slug);
    if (
      await ctx.db
        .query("workspaces")
        .withIndex("by_slug", (q) => q.eq("slug", args.slug))
        .unique()
    )
      throw new ConvexError("This workspace slug is already taken.");
    const settings = validateSettings({ ...defaultSettings, organizationSize: args.organizationSize ?? null });
    const workspaceId = await ctx.db.insert("workspaces", { name, slug, metadataRevision: 0, deletedAt: null });
    if (args.organizationSize !== undefined) await ctx.db.insert("workspaceSettings", { workspaceId, ...settings });
    await ctx.db.insert("workspaceMembers", { workspaceId, userId: user._id, role: "admin", active: true });
    if (args.onboardingRevision !== undefined)
      await recordWorkspaceCreation(ctx, workspaceId, args.onboardingRevision, settings.organizationSize);
    else await selectWorkspaceForUser(ctx, workspaceId);
    return workspaceId;
  },
});

export const members = query({
  args: {
    workspaceId: v.id("workspaces"),
    search: v.optional(v.string()),
    roles: v.optional(v.array(v.union(role, v.literal("suspended")))),
    orderBy: v.optional(memberDirectoryOrder),
  },
  handler: async (ctx, args) => {
    await requireWorkspace(ctx, args.workspaceId, true);
    const memberships = await ctx.db
      .query("workspaceMembers")
      .withIndex("by_workspace_user", (q) => q.eq("workspaceId", args.workspaceId))
      .take(MAX_MEMBER_DIRECTORY_MEMBERS + 1);
    if (memberships.length > MAX_MEMBER_DIRECTORY_MEMBERS)
      throw new ConvexError(
        `Workspace directory exceeds the ${MAX_MEMBER_DIRECTORY_MEMBERS}-membership limit. No partial directory was returned.`
      );
    const rows = await Promise.all(
      memberships.map(async (membership) => {
        const [identity, authLink] = await Promise.all([
          profileIdentity(ctx, membership.userId),
          ctx.db
            .query("betterAuthLinks")
            .withIndex("by_user", (q) => q.eq("userId", membership.userId))
            .unique(),
        ]);
        if (!identity) throw new ConvexError("Workspace membership references an unavailable account.");
        return Object.assign(identity, {
          membershipId: membership._id,
          role: membership.role,
          active: membership.active,
          joinedAt: membership._creationTime,
          loginMethod: authLink?.lastLoginMedium ?? null,
        });
      })
    );
    const search = (args.search ?? "").trim().toLocaleLowerCase();
    const roles = args.roles ?? [];
    const filtered = rows.filter(
      (row) =>
        (!roles.length || roles.includes(row.active ? row.role : "suspended")) &&
        `${row.fullName} ${row.displayName ?? ""} ${row.email ?? ""}`.toLocaleLowerCase().includes(search)
    );
    const ordered = sortMemberDirectory(filtered, args.orderBy);
    const directory = await Promise.all(
      ordered.map(async (row) =>
        Object.assign(row, {
          avatar: row.active
            ? await personalImageDescriptor(ctx, await userAppearance(ctx, row.userId), "avatar", args.workspaceId)
            : null,
        })
      )
    );
    return { members: directory, totalCount: rows.length, roles: role.members.map((entry) => entry.value) };
  },
});

export const changeMemberRole = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    membershipId: v.id("workspaceMembers"),
    expectedRole: role,
    role,
  },
  handler: async (ctx, args) => {
    const access = await requireWorkspace(ctx, args.workspaceId, true);
    if (access.member.role !== "admin") throw new ConvexError("Only workspace administrators can manage members.");
    const membership = await ctx.db.get(args.membershipId);
    if (!membership || membership.workspaceId !== args.workspaceId)
      throw new ConvexError("Workspace membership not found.");
    if (membership.userId === access.user._id) throw new ConvexError("You cannot update your own role.");
    if (!membership.active || membership.role !== args.expectedRole)
      throw new ConvexError("This membership changed. Refresh the directory before updating its role.");
    return grantWorkspaceMembership(ctx, {
      workspaceId: args.workspaceId,
      userId: membership.userId,
      role: args.role,
    });
  },
});

export const revokeMember = mutation({
  args: { workspaceId: v.id("workspaces"), userId: v.id("users") },
  handler: async (ctx, args) => {
    const access = await requireWorkspace(ctx, args.workspaceId, true);
    if (access.member.role !== "admin") throw new ConvexError("Only workspace administrators can manage members.");
    if (access.user._id === args.userId) throw new ConvexError("You cannot remove yourself. Use leave workspace.");
    const existing = await ctx.db
      .query("workspaceMembers")
      .withIndex("by_workspace_user", (q) => q.eq("workspaceId", args.workspaceId).eq("userId", args.userId))
      .unique();
    if (!existing?.active) return;
    await revokeWorkspaceMembership(ctx, existing);
  },
});

export const leave = mutation({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    const { member } = await requireWorkspace(ctx, args.workspaceId);
    await revokeWorkspaceMembership(ctx, member);
  },
});
async function revokeWorkspaceMembership(ctx: MutationCtx, member: Doc<"workspaceMembers">) {
  if (member.role === "admin") await requireAnotherWorkspaceAdmin(ctx, member.workspaceId);
  await restrictProjectMemberships(ctx, member.workspaceId, member.userId, "revoke");
  await ctx.db.patch(member._id, { active: false });
}
export const MAX_ATOMIC_PROJECT_MEMBERSHIPS = 100;

async function restrictProjectMemberships(
  ctx: MutationCtx,
  workspaceId: Id<"workspaces">,
  userId: Id<"users">,
  restriction: "revoke" | "guest"
) {
  const activeMemberships = await ctx.db
    .query("projectMembers")
    .withIndex("by_workspace_user_active", (q) =>
      q.eq("workspaceId", workspaceId).eq("userId", userId).eq("active", true)
    )
    .take(MAX_ATOMIC_PROJECT_MEMBERSHIPS + 1);
  if (activeMemberships.length > MAX_ATOMIC_PROJECT_MEMBERSHIPS)
    throw new ConvexError(
      `Membership change exceeds the atomic budget of ${MAX_ATOMIC_PROJECT_MEMBERSHIPS} active projects. No access changed.`
    );
  for (const member of activeMemberships) {
    // The project membership owner preserves administrator and stale-write invariants.
    // oxlint-disable-next-line no-await-in-loop
    if (restriction === "revoke") await revokeProjectMembership(ctx, member);
    // oxlint-disable-next-line no-await-in-loop
    else await grantProjectMembership(ctx, { workspaceId, projectId: member.projectId, userId, role: "guest" });
  }
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
    await requireAnotherWorkspaceAdmin(ctx, args.workspaceId);
  }
  if (existing) {
    if (existing.active && args.role === "guest")
      await restrictProjectMemberships(ctx, args.workspaceId, args.userId, "guest");
    await ctx.db.patch(existing._id, { role: args.role, active: true });
    return existing._id;
  }
  return ctx.db.insert("workspaceMembers", { ...args, active: true });
}
