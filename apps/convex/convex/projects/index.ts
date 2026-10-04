import { projectCreateArgs } from "./schema";
import { initializeProjectOrder } from "./order_owner";
import { requireUnrestrictedAccount } from "../identity/deactivation/access";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { Id, Doc } from "../_generated/dataModel";
import { createProject } from "./create";
import { v, ConvexError, type Infer } from "convex/values";
import { query, mutation } from "../_generated/server";
import schema, { role } from "../schema";
import { paginationOptsValidator } from "convex/server";
import { stream } from "convex-helpers/server/stream";
import { pageBudget } from "../commercial/validation";
import { MAX_MEMBER_DIRECTORY_MEMBERS, memberDirectoryOrder, sortMemberDirectory } from "../identity/profile_owner";
import { memberIdentity } from "./directory";
import { internal } from "../_generated/api";
import { canAdministerProject } from "./administration";
import {
  requireWorkspace,
  requireProject,
  requireProjectMembership,
  requireAnotherProjectAdmin,
} from "../identity/access";
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
          if (!project || project.archived || project.deletedAt != null) return null;
          const profile = await ctx.db
            .query("projectProfiles")
            .withIndex("by_project", (q) => q.eq("projectId", project._id))
            .unique();
          return Object.assign(project, {
            membershipRole: membership.role,
            workspaceRole: member.role,
            profile: profile && !profile.deleted ? profile : null,
          });
        })
    );
    return projects.filter((p) => p !== null);
  },
});
export const create = mutation({
  args: projectCreateArgs.fields,
  handler: async (ctx, args) => {
    return createProject(ctx, args, await requireWorkspace(ctx, args.workspaceId, true));
  },
});

async function memberAccess(ctx: QueryCtx, projectId: Id<"projects">, manage = false) {
  const access = await requireProject(ctx, projectId);
  const canManage = await canAdministerProject(ctx, access.project, access.user._id, access.member.role);
  if (manage && !canManage) throw new ConvexError("Only workspace or project administrators can manage members.");
  return { ...access, canManage };
}
function memberCapabilities(
  access: Awaited<ReturnType<typeof memberAccess>>,
  target: Doc<"projectMembers"> | null,
  workspaceRole: Doc<"workspaceMembers">["role"]
) {
  const self = target?.userId === access.user._id;
  const editing = target?.active === true;
  const canEdit =
    access.canManage && (!editing || access.member.role === "admin" || (!self && target.role !== "admin"));
  const allowedRoles = canEdit
    ? role.members
        .map((entry) => entry.value)
        .filter((value) => {
          if (workspaceRole === "guest") return value === "guest";
          if (!editing && workspaceRole === "admin") return value === "admin";
          return !editing || access.member.role === "admin" || value !== "admin";
        })
    : [];
  const canRemove =
    access.canManage &&
    editing &&
    !self &&
    (target.role !== "admin" || access.projectMember.role === "admin") &&
    (target.role !== "member" || access.projectMember.role !== "guest");
  return { allowedRoles, canRemove, canLeave: editing && self };
}
function memberRevision(member: Doc<"projectMembers"> | null, expectedRevision: number | null) {
  if (
    expectedRevision === null
      ? member !== null
      : !Number.isSafeInteger(expectedRevision) || member?.revision !== expectedRevision
  )
    throw new ConvexError("Project membership changed. Reload before continuing.");
}
const memberFields = { userId: v.id("users"), role, expectedRevision: v.union(v.number(), v.null()) };
export const members = query({
  args: {
    projectId: v.id("projects"),
    search: v.optional(v.string()),
    roles: v.optional(v.array(role)),
    orderBy: v.optional(memberDirectoryOrder),
  },
  handler: async (ctx, args) => {
    const access = await memberAccess(ctx, args.projectId);
    const { project, canManage } = access;
    const memberships = await ctx.db
      .query("projectMembers")
      .withIndex("by_project_user", (q) => q.eq("projectId", project._id))
      .take(MAX_MEMBER_DIRECTORY_MEMBERS + 1);
    if (memberships.length > MAX_MEMBER_DIRECTORY_MEMBERS)
      throw new ConvexError(
        `Project directory exceeds the ${MAX_MEMBER_DIRECTORY_MEMBERS}-membership limit. No partial directory was returned.`
      );
    const search = (args.search ?? "").trim().toLowerCase();
    const rows = await Promise.all(
      memberships.map(async (member) => {
        if (!member.active || (args.roles?.length && !args.roles.includes(member.role))) return null;
        const identity = await memberIdentity(
          ctx,
          access.project.workspaceId,
          access.member.role,
          member.userId,
          search
        );
        return identity
          ? Object.assign(identity, {
              membershipId: member._id,
              role: member.role,
              active: member.active,
              revision: member.revision,
              joinedAt: member._creationTime,
              ...memberCapabilities(access, member, identity.workspaceRole),
            })
          : null;
      })
    );
    return {
      members: sortMemberDirectory(
        rows.filter((row) => row !== null),
        args.orderBy
      ),
      canManage,
      roles: role.members.map((entry) => entry.value),
    };
  },
});
export const availableMembers = query({
  args: { projectId: v.id("projects"), search: v.optional(v.string()), paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const access = await memberAccess(ctx, args.projectId);
    const { project } = access;
    const budget = pageBudget(args.paginationOpts);
    if (!access.canManage) return { page: [], isDone: true, continueCursor: "", canManage: false };
    const search = (args.search ?? "").trim().toLowerCase();
    const result = await stream(ctx.db, schema)
      .query("workspaceMembers")
      .withIndex("by_workspace_user", (q) => q.eq("workspaceId", project.workspaceId))
      .map(async (workspaceMember) => {
        if (!workspaceMember.active) return null;
        const member = await ctx.db
          .query("projectMembers")
          .withIndex("by_project_user", (q) => q.eq("projectId", project._id).eq("userId", workspaceMember.userId))
          .unique();
        if (member?.active) return null;
        const identity = await memberIdentity(
          ctx,
          access.project.workspaceId,
          access.member.role,
          workspaceMember.userId,
          search
        );
        return identity
          ? Object.assign(identity, {
              expectedRevision: member?.revision ?? null,
              ...memberCapabilities(access, member, identity.workspaceRole),
            })
          : null;
      })
      .paginate(budget);
    return { ...result, canManage: true };
  },
});
export const resolveMember = query({
  args: { projectId: v.id("projects"), userId: v.string() },
  handler: async (ctx, args) => {
    const access = await memberAccess(ctx, args.projectId, true);
    const { project } = access;
    const userId = ctx.db.normalizeId("users", args.userId);
    if (!userId) throw new ConvexError("User not found.");
    const identity = await memberIdentity(ctx, access.project.workspaceId, access.member.role, userId, "");
    if (!identity) throw new ConvexError("An active member of this workspace is required.");
    const member = await ctx.db
      .query("projectMembers")
      .withIndex("by_project_user", (q) => q.eq("projectId", project._id).eq("userId", userId))
      .unique();
    return {
      ...identity,
      expectedRevision: member?.revision ?? null,
      active: member?.active === true,
      role: member?.role ?? null,
      ...memberCapabilities(access, member, identity.workspaceRole),
    };
  },
});
export const grantMember = mutation({
  args: { projectId: v.id("projects"), ...memberFields },
  handler: async (ctx, { expectedRevision, ...args }) => {
    const access = await memberAccess(ctx, args.projectId, true);
    const { project } = access;
    const member = await ctx.db
      .query("projectMembers")
      .withIndex("by_project_user", (q) => q.eq("projectId", project._id).eq("userId", args.userId))
      .unique();
    memberRevision(member, expectedRevision);
    const identity = await memberIdentity(ctx, access.project.workspaceId, access.member.role, args.userId, "");
    if (!identity || !memberCapabilities(access, member, identity.workspaceRole).allowedRoles.includes(args.role))
      throw new ConvexError("You cannot assign this project role to this member.");
    const membershipId = await grantProjectMembership(ctx, { ...args, workspaceId: project.workspaceId });
    if (!member?.active)
      await ctx.scheduler.runAfter(0, internal.invitations.email.projectAdded, {
        membershipId,
        expectedRevision: member ? member.revision + 1 : 0,
        addedById: access.user._id,
      });
    return membershipId;
  },
});
export const addMembers = mutation({
  args: { projectId: v.id("projects"), members: v.array(v.object(memberFields)) },
  handler: async (ctx, args) => {
    const access = await memberAccess(ctx, args.projectId, true);
    const { project } = access;
    if (
      !args.members.length ||
      args.members.length > 20 ||
      new Set(args.members.map((entry) => entry.userId)).size !== args.members.length
    )
      throw new ConvexError("Choose between 1 and 20 distinct workspace members.");
    for (const entry of args.members) {
      // Sequential grants preserve personal project ordering in one transaction.
      // oxlint-disable-next-line no-await-in-loop
      const member = await ctx.db
        .query("projectMembers")
        .withIndex("by_project_user", (q) => q.eq("projectId", project._id).eq("userId", entry.userId))
        .unique();
      memberRevision(member, entry.expectedRevision);
      if (member?.active)
        throw new ConvexError("A selected person is already a project member. Reload before adding members.");
      // oxlint-disable-next-line no-await-in-loop
      const identity = await memberIdentity(ctx, access.project.workspaceId, access.member.role, entry.userId, "");
      if (!identity || !memberCapabilities(access, member, identity.workspaceRole).allowedRoles.includes(entry.role))
        throw new ConvexError("You cannot add a selected person with this project role.");
      // oxlint-disable-next-line no-await-in-loop
      const membershipId = await grantProjectMembership(ctx, {
        workspaceId: project.workspaceId,
        projectId: project._id,
        userId: entry.userId,
        role: entry.role,
      });
      // Notification scheduling commits with the single membership grant, never a new invitation.
      // oxlint-disable-next-line no-await-in-loop
      await ctx.scheduler.runAfter(0, internal.invitations.email.projectAdded, {
        membershipId,
        expectedRevision: member ? member.revision + 1 : 0,
        addedById: access.user._id,
      });
    }
  },
});
export const revokeMember = mutation({
  args: { projectId: v.id("projects"), userId: v.id("users"), expectedRevision: v.number() },
  handler: async (ctx, args) => {
    const access = await memberAccess(ctx, args.projectId, true);
    const { project, user } = access;
    if (args.userId === user._id) throw new ConvexError("Use Leave project to remove your own membership.");
    const member = await ctx.db
      .query("projectMembers")
      .withIndex("by_project_user", (q) => q.eq("projectId", project._id).eq("userId", args.userId))
      .unique();
    memberRevision(member, args.expectedRevision);
    if (!member?.active) throw new ConvexError("Project membership is no longer active.");
    const identity = await memberIdentity(ctx, access.project.workspaceId, access.member.role, member.userId, "");
    if (!identity || !memberCapabilities(access, member, identity.workspaceRole).canRemove)
      throw new ConvexError("You cannot remove this project member.");
    await revokeProjectMembership(ctx, member);
  },
});

export const leave = mutation({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    const project = await ctx.db.get(args.projectId);
    if (!project) throw new ConvexError("Project not found.");
    // Archived projects remain leaveable; this does not permit editing archived content.
    const { projectMember, workspace } = await requireProjectMembership(ctx, project);
    await revokeProjectMembership(ctx, projectMember);
    return { workspaceSlug: workspace.slug };
  },
});
export async function revokeProjectMembership(ctx: MutationCtx, member: Doc<"projectMembers">) {
  if (!member.active) return;
  if (member.role === "admin") await requireAnotherProjectAdmin(ctx, member.projectId);
  await deactivateProjectMembership(ctx, member);
}

export async function deactivateProjectMembership(ctx: MutationCtx, member: Doc<"projectMembers">) {
  await ctx.db.patch(member._id, { active: false, revision: member.revision + 1 });
}

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
  await initializeProjectOrder(ctx, { workspaceId, projectId: args.projectId, userId: args.userId });
  if (existing) {
    if (existing.active && existing.role === args.role) return existing._id;
    await ctx.db.patch(existing._id, { role: args.role, active: true, revision: existing.revision + 1 });
    return existing._id;
  }
  return ctx.db.insert("projectMembers", {
    ...membership,
    workspaceId,
    active: true,
    revision: 0,
    apiSortOrder: 65535,
  });
}
