"use node";
import { randomBytes } from "node:crypto";
import { v } from "convex/values";
import { action } from "../_generated/server";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { role } from "../schema";
import { tokenDigest as digest } from "./token_crypto";
import type { InvitationResponse } from "./index";
export const create = action({
  args: { workspaceId: v.id("workspaces"), projectId: v.union(v.id("projects"), v.null()), email: v.string(), role },
  handler: async (ctx, args): Promise<{ invitationId: Id<"invitations">; token: string }> => {
    const token = randomBytes(32).toString("hex");
    const invitationId = await ctx.runMutation(internal.invitations.index.issue, { ...args, tokenHash: digest(token) });
    return { invitationId, token };
  },
});
export const rotate = action({
  args: { invitationId: v.id("invitations"), expectedRevision: v.number() },
  handler: async (ctx, args) => {
    const token = randomBytes(32).toString("hex");
    await ctx.runMutation(internal.invitations.index.rotate, { ...args, tokenHash: digest(token) });
    return { token };
  },
});
export const respond = action({
  args: { invitationId: v.id("invitations"), token: v.string(), accepted: v.boolean() },
  handler: async (ctx, { token, ...args }): Promise<InvitationResponse> =>
    ctx.runMutation(internal.invitations.index.respond, { ...args, tokenHash: digest(token) }),
});
