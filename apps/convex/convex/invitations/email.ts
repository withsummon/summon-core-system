"use node";
import { randomBytes } from "node:crypto";
import { ConvexError, v } from "convex/values";
import type { invitationPreview } from "./delivery";
import { action } from "../_generated/server";
import type { ActionCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { internal } from "../_generated/api";
import { role } from "../schema";
import { tokenDigest } from "./token_crypto";
import { mailConfiguration } from "../identity/mail/config";
import { sendAccountEmail } from "../identity/mail/sender";
function configuration() {
  const config = mailConfiguration(process.env);
  if (!config) throw new ConvexError("Invitation email delivery is not configured.");
  return config;
}
async function deliver(ctx: ActionCtx, invitationId: Id<"invitations">, token: string) {
  const config = configuration();
  const tokenHash = tokenDigest(token);
  const context = await ctx.runQuery(internal.invitations.delivery.sending, { invitationId, tokenHash });
  const url = new URL("/workspace-invitations/", config.siteUrl);
  url.searchParams.set("invitation_id", invitationId);
  url.searchParams.set("slug", context.workspace.slug);
  url.searchParams.set("token", token);
  let status: "sent" | "failed" = "failed";
  try {
    await sendAccountEmail(
      context.email,
      `Invitation to ${context.workspace.name} on Summon`,
      `You have been invited to ${context.workspace.name}${context.projectName ? ` (${context.projectName})` : ""}.\n\nOpen this link to review the invitation and sign in with your invited email:\n\n${url.href}\n\nThis invitation expires in seven days.`,
      `invitation-${invitationId}-${context.revision}`
    );
    status = "sent";
  } catch {
    /* Delivery is reported explicitly; provider error details are not persisted. */
  }
  await ctx.runMutation(internal.invitations.delivery.record, { invitationId, tokenHash, status });
  return { invitationId, delivery: status };
}
export const send = action({
  args: { workspaceId: v.id("workspaces"), projectId: v.union(v.id("projects"), v.null()), email: v.string(), role },
  handler: async (ctx, args): Promise<{ invitationId: Id<"invitations">; delivery: "sent" | "failed" }> => {
    configuration();
    const token = randomBytes(32).toString("hex");
    const invitationId = await ctx.runMutation(internal.invitations.index.issue, {
      ...args,
      tokenHash: tokenDigest(token),
    });
    return deliver(ctx, invitationId, token);
  },
});
export const resend = action({
  args: { invitationId: v.id("invitations"), expectedRevision: v.number() },
  handler: async (ctx, args): Promise<{ invitationId: Id<"invitations">; delivery: "sent" | "failed" }> => {
    configuration();
    const token = randomBytes(32).toString("hex");
    await ctx.runMutation(internal.invitations.index.rotate, { ...args, tokenHash: tokenDigest(token) });
    return deliver(ctx, args.invitationId, token);
  },
});
type Preview = Omit<Awaited<ReturnType<typeof invitationPreview>>, "logo"> & {
  logo: { contentType: string; bytes: ArrayBuffer } | null;
};
async function readPreview(
  ctx: ActionCtx,
  read: () => Promise<Awaited<ReturnType<typeof invitationPreview>>>
): Promise<Preview> {
  const data = await read();
  const blob = data.logo ? await ctx.storage.get(data.logo.storageId) : null;
  const bytes = blob ? await blob.arrayBuffer() : null;
  const latest = await read();
  if (latest.logo?.id !== data.logo?.id) throw new ConvexError("Invitation logo changed. Reload the invitation.");
  return { ...latest, logo: bytes && data.logo ? { contentType: data.logo.contentType, bytes } : null };
}
export const preview = action({
  args: { invitationId: v.string(), token: v.string() },
  handler: async (ctx, args): Promise<Preview> => {
    const input = { invitationId: args.invitationId, tokenHash: tokenDigest(args.token) };
    return readPreview(ctx, () => ctx.runQuery(internal.invitations.delivery.preview, input));
  },
});
export const incomingPreview = action({
  args: { invitationId: v.id("invitations") },
  handler: (ctx, args): Promise<Preview> =>
    readPreview(ctx, () => ctx.runQuery(internal.invitations.delivery.incomingPreview, args)),
});
