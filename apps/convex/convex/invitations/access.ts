import { accountRestricted, requireUnrestrictedAccount } from "../identity/deactivation/access";
import { ConvexError } from "convex/values";
import type { QueryCtx } from "../_generated/server";
import type { Id, Doc } from "../_generated/dataModel";
import { requireUser } from "../identity/access";
export const INVITATION_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;
const rank = { guest: 0, member: 1, admin: 2 };
export function normalizedEmail(value: string) {
  const email = value.trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    throw new ConvexError("Enter a valid email address.");
  return email;
}
async function invitationDenial(
  ctx: QueryCtx,
  workspaceId: Id<"workspaces">,
  projectId: Id<"projects"> | null,
  userId: Id<"users">,
  role: Doc<"invitations">["role"]
) {
  if (await accountRestricted(ctx, userId)) return "Invitation authority is unavailable.";
  const workspace = await ctx.db.get(workspaceId);
  const member = await ctx.db
    .query("workspaceMembers")
    .withIndex("by_workspace_user", (q) => q.eq("workspaceId", workspaceId).eq("userId", userId))
    .unique();
  if (
    !workspace ||
    workspace.deletedAt != null ||
    !member?.active ||
    member.role === "guest" ||
    (rank[member.role] < rank[role] && projectId === null)
  )
    return "Invitation authority is unavailable.";
  if (projectId && !(await projectIssuer(ctx, workspaceId, projectId, userId)))
    return "Only current project administrators can invite members.";
  return null;
}
export async function canIssueInvitation(
  ctx: QueryCtx,
  workspaceId: Id<"workspaces">,
  projectId: Id<"projects"> | null,
  userId: Id<"users">,
  role: Doc<"invitations">["role"]
) {
  return (await invitationDenial(ctx, workspaceId, projectId, userId, role)) === null;
}
export async function issuerAccess(
  ctx: QueryCtx,
  workspaceId: Id<"workspaces">,
  projectId: Id<"projects"> | null,
  userId: Id<"users">,
  role: Doc<"invitations">["role"]
) {
  await requireUnrestrictedAccount(ctx, userId);
  const denial = await invitationDenial(ctx, workspaceId, projectId, userId, role);
  if (denial) throw new ConvexError(denial);
}
export async function recipient(ctx: QueryCtx) {
  const user = await requireUser(ctx);
  if (!user.email || user.emailVerificationTime === undefined)
    throw new ConvexError("Verify your email before responding to invitations.");
  return { user, email: normalizedEmail(user.email) };
}
export function publicInvitation(row: Doc<"invitations">) {
  return {
    _id: row._id,
    workspaceId: row.workspaceId,
    projectId: row.projectId,
    email: row.email,
    role: row.role,
    inviterId: row.inviterId,
    expiresAt: row.expiresAt,
    revision: row.revision,
    status: row.status,
    delivery: row.delivery?.revision === row.revision ? row.delivery.status : null,
    respondedAt: row.respondedAt,
    respondedBy: row.respondedBy,
  };
}

async function projectIssuer(
  ctx: QueryCtx,
  workspaceId: Id<"workspaces">,
  projectId: Id<"projects">,
  userId: Id<"users">
) {
  const project = await ctx.db.get(projectId);
  const membership = await ctx.db
    .query("projectMembers")
    .withIndex("by_project_user", (q) => q.eq("projectId", projectId).eq("userId", userId))
    .unique();
  if (
    !project ||
    project.workspaceId !== workspaceId ||
    project.archived ||
    project.deletedAt != null ||
    !membership?.active ||
    membership.role !== "admin"
  )
    return false;
  return true;
}
