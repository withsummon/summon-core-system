import { ConvexError, v } from "convex/values";
import { internalQuery, internalMutation } from "../_generated/server";
import { requireProject, requireProjectForUser, requireUser, requireWorkspace } from "../identity/access";
import { issuerAccess, normalizedEmail } from "./access";
import { accountRestricted } from "../identity/deactivation/access";
import { canAdministerProject } from "../projects/administration";
import { workspaceLogo } from "../settings/logo_owner";
import { invitationDeliveryStatus } from "../schema";
import type { QueryCtx } from "../_generated/server";
import type { Doc } from "../_generated/dataModel";
import type { Infer } from "convex/values";

export const previewFields = { invitationId: v.string() };
const previewInput = v.object(previewFields);

export async function recipient(ctx: QueryCtx) {
  const user = await requireUser(ctx);
  if (!user.email || user.emailVerificationTime === undefined)
    throw new ConvexError("Verify your email before responding to invitations.");
  return { user, email: normalizedEmail(user.email) };
}
async function invitationContext(ctx: QueryCtx, row: Doc<"invitations">) {
  const status = row.status;
  if ((status !== "pending" && status !== "accepted") || row.expiresAt <= Date.now())
    throw new ConvexError("Invitation is unavailable.");
  if (row.status === "accepted") {
    await requireWorkspace(ctx, row.workspaceId);
    if (row.projectId) await requireProject(ctx, row.projectId);
  } else await issuerAccess(ctx, row.workspaceId, row.projectId, row.inviterId, row.role);
  const workspace = await ctx.db.get(row.workspaceId);
  if (!workspace) throw new ConvexError("Invitation is unavailable.");
  const project = row.projectId ? await ctx.db.get(row.projectId) : null;
  return { status, workspace, project };
}
export const sending = internalQuery({
  args: { invitationId: v.id("invitations"), expectedRevision: v.number() },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const row = await ctx.db.get(args.invitationId);
    if (!row || row.status !== "pending" || row.revision !== args.expectedRevision) return null;
    const { workspace, project } = await invitationContext(ctx, row);
    await issuerAccess(ctx, row.workspaceId, row.projectId, user._id, row.role);
    return {
      email: row.email,
      workspaceName: workspace.name,
      projectName: project?.name ?? null,
    };
  },
});
export const record = internalMutation({
  args: {
    invitationId: v.id("invitations"),
    expectedRevision: v.number(),
    status: invitationDeliveryStatus,
  },
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.invitationId);
    if (!row || row.revision !== args.expectedRevision || row.status !== "pending") return false;
    await ctx.db.patch(row._id, {
      delivery: { status: args.status, revision: args.expectedRevision, attemptedAt: Date.now() },
    });
    return true;
  },
});
export async function invitationPreview(ctx: QueryCtx, args: Infer<typeof previewInput>) {
  const { user, email } = await recipient(ctx);
  const invitationId = ctx.db.normalizeId("invitations", args.invitationId);
  const row = invitationId ? await ctx.db.get(invitationId) : null;
  if (!row || row.email !== email || (row.status === "accepted" && row.respondedBy !== user._id))
    throw new ConvexError("Invitation is unavailable.");
  const { status, workspace, project } = await invitationContext(ctx, row);
  const logo = await workspaceLogo(ctx, workspace._id);
  const asset = logo ? await ctx.db.get(logo.id) : null;
  return {
    id: row._id,
    email: row.email,
    role: row.role,
    revision: row.revision,
    expiresAt: row.expiresAt,
    status,
    workspace: { id: workspace._id, name: workspace.name, slug: workspace.slug },
    project: project ? { id: project._id, name: project.name, identifier: project.identifier } : null,
    logo: logo && asset?.storageId ? { id: logo.id, storageId: asset.storageId, contentType: logo.contentType } : null,
  };
}
export const incomingPreview = internalQuery({
  args: previewFields,
  handler: invitationPreview,
});

export const projectAddition = internalQuery({
  args: { membershipId: v.id("projectMembers"), expectedRevision: v.number(), addedById: v.id("users") },
  handler: async (ctx, args) => {
    const member = await ctx.db.get(args.membershipId);
    if (!member?.active || member.revision !== args.expectedRevision) return null;
    const [addedBy, addedUser] = await Promise.all([ctx.db.get(args.addedById), ctx.db.get(member.userId)]);
    if (
      !addedBy ||
      !addedUser?.email ||
      (await accountRestricted(ctx, addedBy._id)) ||
      (await accountRestricted(ctx, addedUser._id))
    )
      return null;
    const access = await requireProjectForUser(ctx, member.projectId, addedBy);
    if (!(await canAdministerProject(ctx, access.project, addedBy._id, access.member.role))) return null;
    await requireProjectForUser(ctx, member.projectId, addedUser);
    return {
      email: addedUser.email,
      projectName: access.project.name,
      workspaceName: access.workspace.name,
      workspaceSlug: access.workspace.slug,
      projectId: access.project._id,
    };
  },
});
