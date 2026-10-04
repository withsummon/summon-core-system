import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { stream } from "convex-helpers/server/stream";
import schema from "../schema";
import { query } from "../_generated/server";
import type { QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { requireProjectDiscovery, canDiscover, storedNetwork } from "./network_access";
import { requireWorkspace } from "../identity/access";
import { pageBudget } from "../commercial/validation";
import { profileIdentity } from "../identity/profile_owner";
import { accountRestricted } from "../identity/deactivation/access";
import { personalImageDescriptor, userAppearance } from "../identity/avatar_owner";

export async function memberIdentity(
  ctx: QueryCtx,
  workspaceId: Id<"workspaces">,
  viewerWorkspaceRole: Doc<"workspaceMembers">["role"],
  userId: Id<"users">,
  search: string
) {
  const workspaceMember = await ctx.db
    .query("workspaceMembers")
    .withIndex("by_workspace_user", (q) => q.eq("workspaceId", workspaceId).eq("userId", userId))
    .unique();
  if (!workspaceMember?.active || (await accountRestricted(ctx, userId))) return null;
  const identity = await profileIdentity(ctx, userId);
  if (!identity) return null;
  const email = viewerWorkspaceRole === "guest" ? null : identity.email;
  if (!`${identity.fullName} ${identity.displayName ?? ""} ${email ?? ""}`.toLowerCase().includes(search)) return null;
  return {
    ...identity,
    email,
    workspaceRole: workspaceMember.role,
    avatar: await personalImageDescriptor(ctx, await userAppearance(ctx, userId), "avatar", workspaceId),
  };
}
export async function directoryPerson(
  ctx: QueryCtx,
  userId: Id<"users">,
  workspaceId: Id<"workspaces">,
  viewerWorkspaceRole: Doc<"workspaceMembers">["role"]
) {
  const identity = await memberIdentity(ctx, workspaceId, viewerWorkspaceRole, userId, "");
  return identity
    ? {
        userId: identity.userId,
        name: identity.fullName || identity.displayName?.trim() || `Member ${userId.slice(-6)}`,
        avatar: identity.avatar,
      }
    : null;
}
// Each returned row contributes one currently active human member. The total
// requires cursor exhaustion; there is no silently truncated member count.
export const members = query({
  args: { projectId: v.id("projects"), paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const { project, member } = await requireProjectDiscovery(ctx, args.projectId);
    return stream(ctx.db, schema)
      .query("projectMembers")
      .withIndex("by_project_user", (q) => q.eq("projectId", project._id))
      .map(async (row) =>
        row.active && row.workspaceId === project.workspaceId
          ? directoryPerson(ctx, row.userId, project.workspaceId, member.role)
          : null
      )
      .paginate(pageBudget(args.paginationOpts));
  },
});

// One contribution per active human membership in a discoverable project.
// The directory folds current pages only after both project and roster cursors
// are exhausted, so counts and member filters never imply incomplete coverage.
export const memberships = query({
  args: { workspaceId: v.id("workspaces"), paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const access = await requireWorkspace(ctx, args.workspaceId);
    return stream(ctx.db, schema)
      .query("projectMembers")
      .withIndex("by_workspace_user", (q) => q.eq("workspaceId", args.workspaceId))
      .map(async (row) => {
        if (!row.active) return null;
        const project = await ctx.db.get(row.projectId);
        if (!project || project.workspaceId !== args.workspaceId || project.deletedAt != null) return null;
        const caller = await ctx.db
          .query("projectMembers")
          .withIndex("by_project_user", (q) => q.eq("projectId", project._id).eq("userId", access.user._id))
          .unique();
        if (!canDiscover(storedNetwork(project), access.member.role, caller?.active === true)) return null;
        const member = await directoryPerson(ctx, row.userId, project.workspaceId, access.member.role);
        return member ? Object.assign(member, { projectId: project._id }) : null;
      })
      .paginate(pageBudget(args.paginationOpts));
  },
});
