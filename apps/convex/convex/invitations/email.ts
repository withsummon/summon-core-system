"use node";
import { ConvexError, v } from "convex/values";
import type { invitationPreview } from "./delivery";
import { previewFields } from "./delivery";
import { createFields } from "./index";
import { action, internalAction } from "../_generated/server";
import type { ActionCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import type { Infer } from "convex/values";
import { api, internal } from "../_generated/api";
import { invitationDeliveryStatus } from "../schema";
import { mailConfiguration } from "../identity/mail/config";
import { sendAccountEmail } from "../identity/mail/sender";

const deliveryReceipt = v.object({
  invitationId: v.id("invitations"),
  delivery: v.union(invitationDeliveryStatus, v.null()),
  revision: v.number(),
});

function configuration() {
  const config = mailConfiguration(process.env);
  if (!config) throw new ConvexError("Invitation email delivery is not configured.");
  return config;
}
async function deliver(
  ctx: ActionCtx,
  invitationId: Id<"invitations">,
  expectedRevision: number
): Promise<Infer<typeof deliveryReceipt>> {
  const config = configuration();
  const context = await ctx.runQuery(internal.invitations.delivery.sending, { invitationId, expectedRevision });
  if (!context) return { invitationId, delivery: null, revision: expectedRevision };
  const url = new URL("/workspace-invitations/", config.siteUrl);
  url.searchParams.set("invitation_id", invitationId);
  let status: Infer<typeof invitationDeliveryStatus> = "failed";
  try {
    await sendAccountEmail(
      context.email,
      `Invitation to ${context.workspaceName} on Summon`,
      `You have been invited to ${context.workspaceName}${context.projectName ? ` (${context.projectName})` : ""}.\n\nOpen this link to review the invitation and sign in with your invited email:\n\n${url.href}\n\nThis invitation expires in seven days.`,
      `invitation-${invitationId}-${expectedRevision}`
    );
    status = "sent";
  } catch {
    /* Delivery is reported explicitly; provider error details are not persisted. */
  }
  const recorded = await ctx.runMutation(internal.invitations.delivery.record, {
    invitationId,
    expectedRevision,
    status,
  });
  return { invitationId, delivery: recorded ? status : null, revision: expectedRevision };
}
export const send = action({
  args: createFields,
  returns: v.array(deliveryReceipt),
  handler: async (ctx, args): Promise<Awaited<ReturnType<typeof deliver>>[]> => {
    configuration();
    const invitations = await ctx.runMutation(api.invitations.index.create, args);
    return Promise.all(invitations.map((row) => deliver(ctx, row.invitationId, row.revision)));
  },
});
export const resend = action({
  args: { invitationId: v.id("invitations"), expectedRevision: v.number() },
  returns: deliveryReceipt,
  handler: async (ctx, args): Promise<Awaited<ReturnType<typeof deliver>>> => {
    configuration();
    const invitation = await ctx.runMutation(internal.invitations.index.prepareResend, args);
    return deliver(ctx, invitation.invitationId, invitation.revision);
  },
});
export const incomingPreview = action({
  args: previewFields,
  handler: async (ctx, args) => {
    const data: Awaited<ReturnType<typeof invitationPreview>> = await ctx.runQuery(
      internal.invitations.delivery.incomingPreview,
      args
    );
    const blob = data.logo ? await ctx.storage.get(data.logo.storageId) : null;
    const bytes = blob ? await blob.arrayBuffer() : null;
    const latest: Awaited<ReturnType<typeof invitationPreview>> = await ctx.runQuery(
      internal.invitations.delivery.incomingPreview,
      args
    );
    if (latest.logo?.id !== data.logo?.id) throw new ConvexError("Invitation logo changed. Reload the invitation.");
    return { ...latest, logo: bytes && data.logo ? { contentType: data.logo.contentType, bytes } : null };
  },
});

export const projectAdded = internalAction({
  args: { membershipId: v.id("projectMembers"), expectedRevision: v.number(), addedById: v.id("users") },
  handler: async (ctx, args) => {
    const context = await ctx.runQuery(internal.invitations.delivery.projectAddition, args);
    if (!context) return;
    const config = configuration();
    const url = new URL(`/${context.workspaceSlug}/projects/${context.projectId}/issues/`, config.siteUrl);
    await sendAccountEmail(
      context.email,
      `You have been added to ${context.projectName} on Summon`,
      `You now have access to ${context.projectName} in ${context.workspaceName}.\n\nOpen the project:\n\n${url.href}`,
      `project-added-${args.membershipId}-${args.expectedRevision}`
    );
  },
});
