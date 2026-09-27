import { ConvexError, v } from "convex/values";
import { internalQuery, internalMutation, query } from "../_generated/server";
import { requireUser } from "../identity/access";
import { issuerAccess, normalizedEmail } from "./access";
import { mailConfiguration } from "../identity/mail/config";
import { workspaceLogo } from "../settings/logo_owner";
import type { QueryCtx } from "../_generated/server";
export async function recipient(ctx: QueryCtx) {
  const user = await requireUser(ctx);
  if (!user.email || user.emailVerificationTime === undefined)
    throw new ConvexError("Verify your email before responding to invitations.");
  return { user, email: normalizedEmail(user.email) };
}
async function invitationContext(ctx: QueryCtx, id: string, tokenHash?: string) {
  const invitationId = ctx.db.normalizeId("invitations", id);
  const row = invitationId ? await ctx.db.get(invitationId) : null;
  if (
    !row ||
    (tokenHash !== undefined && row.tokenHash !== tokenHash) ||
    row.status !== "pending" ||
    row.expiresAt <= Date.now()
  )
    throw new ConvexError("Invitation is unavailable.");
  await issuerAccess(ctx, row.workspaceId, row.projectId, row.inviterId, row.role);
  const workspace = await ctx.db.get(row.workspaceId);
  if (!workspace) throw new ConvexError("Invitation is unavailable.");
  const project = row.projectId ? await ctx.db.get(row.projectId) : null;
  return { row, workspace, project };
}
export const availability = query({
  args: {},
  handler: async (ctx) => {
    await requireUser(ctx);
    return { available: mailConfiguration(process.env) !== null };
  },
});
export const sending = internalQuery({
  args: { invitationId: v.id("invitations"), tokenHash: v.string() },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const { row, workspace, project } = await invitationContext(ctx, args.invitationId, args.tokenHash);
    await issuerAccess(ctx, row.workspaceId, row.projectId, user._id, row.role);
    return {
      email: row.email,
      workspace: { name: workspace.name, slug: workspace.slug },
      projectName: project?.name ?? null,
      revision: row.revision,
    };
  },
});
export const record = internalMutation({
  args: {
    invitationId: v.id("invitations"),
    tokenHash: v.string(),
    status: v.union(v.literal("sent"), v.literal("failed")),
  },
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.invitationId);
    if (row?.tokenHash !== args.tokenHash || row.status !== "pending") return;
    await ctx.db.patch(row._id, { delivery: { status: args.status, revision: row.revision, attemptedAt: Date.now() } });
  },
});
export async function invitationPreview(ctx: QueryCtx, args: { invitationId: string; tokenHash?: string }) {
  const { row, workspace, project } = await invitationContext(ctx, args.invitationId, args.tokenHash);
  const logo = await workspaceLogo(ctx, workspace._id);
  const asset = logo ? await ctx.db.get(logo.id) : null;
  return {
    id: row._id,
    email: row.email,
    role: row.role,
    expiresAt: row.expiresAt,
    workspace: { id: workspace._id, name: workspace.name, slug: workspace.slug },
    project: project ? { id: project._id, name: project.name, identifier: project.identifier } : null,
    logo: logo && asset?.storageId ? { id: logo.id, storageId: asset.storageId, contentType: logo.contentType } : null,
  };
}
export const preview = internalQuery({
  args: { invitationId: v.string(), tokenHash: v.string() },
  handler: invitationPreview,
});

export const incomingPreview = internalQuery({
  args: { invitationId: v.id("invitations") },
  handler: async (ctx, args) => {
    const { email } = await recipient(ctx);
    const row = await ctx.db.get(args.invitationId);
    if (!row || row.email !== email) throw new ConvexError("Invitation is unavailable.");
    return invitationPreview(ctx, args);
  },
});
