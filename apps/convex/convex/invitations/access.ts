import { requireUnrestrictedAccount } from "../identity/deactivation/access";
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
export async function issuerAccess(
  ctx: QueryCtx,
  workspaceId: Id<"workspaces">,
  projectId: Id<"projects"> | null,
  userId: Id<"users">,
  role: Doc<"invitations">["role"]
) {
  await requireUnrestrictedAccount(ctx, userId);
  const workspace = await ctx.db.get(workspaceId);
  const member = await ctx.db
    .query("workspaceMembers")
    .withIndex("by_workspace_user", (q) => q.eq("workspaceId", workspaceId).eq("userId", userId))
    .unique();
  if (
    !workspace ||
    !member?.active ||
    member.role === "guest" ||
    (rank[member.role] < rank[role] && projectId === null)
  )
    throw new ConvexError("Invitation authority is unavailable.");
  if (projectId) await projectIssuer(ctx, workspaceId, projectId, userId);
  return member;
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
    throw new ConvexError("Only current project administrators can invite members.");
}
