"use node";
import { randomBytes, createHash } from "node:crypto";
import { v, ConvexError } from "convex/values";
import { action } from "../_generated/server";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { role } from "../schema";
function digest(token: string) {
  if (!/^[a-f0-9]{64}$/.test(token)) throw new ConvexError("Invitation token is invalid.");
  return createHash("sha256").update(token).digest("hex");
}
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
  handler: async (
    ctx,
    { token, ...args }
  ): Promise<{ accepted: boolean; workspaceId: Id<"workspaces">; projectId: Id<"projects"> | null }> =>
    ctx.runMutation(internal.invitations.index.respond, { ...args, tokenHash: digest(token) }),
});
