import { v, ConvexError } from "convex/values";
import { action, internalQuery, internalMutation, mutation } from "../_generated/server";
import { internal } from "../_generated/api";
import { requireProof } from "./sensitiveAccess";
import { audit } from "./access";
import { encrypt, decrypt } from "./crypto";
export const revealSecret = internalQuery({
  args: { proofId: v.id("mcpStepUps") },
  handler: async (ctx, args) => {
    const { credential } = await requireProof(ctx, args.proofId, "reveal");
    const secret = await ctx.db
      .query("mcpSecrets")
      .withIndex("by_credential", (q) => q.eq("credentialId", credential._id))
      .unique();
    if (!secret) throw new ConvexError("Credential secret is unavailable.");
    return secret;
  },
});
export const recordReveal = internalMutation({
  args: { proofId: v.id("mcpStepUps") },
  handler: async (ctx, args) => {
    const { credential, user, proof } = await requireProof(ctx, args.proofId, "reveal");
    await ctx.db.patch(proof._id, { consumed: true });
    await audit(ctx, credential, user._id, "reveal");
  },
});
export const reveal = action({
  args: { proofId: v.id("mcpStepUps") },
  handler: async (ctx, args): Promise<string> => {
    const secret = await ctx.runQuery(internal.mcp.sensitive.revealSecret, args);
    const plaintext = await decrypt(secret);
    await ctx.runMutation(internal.mcp.sensitive.recordReveal, args);
    return plaintext;
  },
});
export const replaceSecret = internalMutation({
  args: { proofId: v.id("mcpStepUps"), ciphertext: v.string(), nonce: v.string(), keyVersion: v.literal(2) },
  handler: async (ctx, { proofId, ...encrypted }) => {
    const { credential, user, proof } = await requireProof(ctx, proofId, "rotate");
    const secret = await ctx.db
      .query("mcpSecrets")
      .withIndex("by_credential", (q) => q.eq("credentialId", credential._id))
      .unique();
    if (!secret) throw new ConvexError("Credential secret is unavailable.");
    await ctx.db.patch(proof._id, { consumed: true });
    await ctx.db.patch(secret._id, encrypted);
    await ctx.db.patch(credential._id, { revision: credential.revision + 1 });
    await audit(ctx, credential, user._id, "rotate");
  },
});
export const authorizeRotate = internalQuery({
  args: { proofId: v.id("mcpStepUps") },
  handler: async (ctx, args) => {
    await requireProof(ctx, args.proofId, "rotate");
  },
});
export const rotate = action({
  args: { proofId: v.id("mcpStepUps"), secret: v.string() },
  handler: async (ctx, { proofId, secret }): Promise<void> => {
    await ctx.runQuery(internal.mcp.sensitive.authorizeRotate, { proofId });
    const encrypted = await encrypt(secret);
    await ctx.runMutation(internal.mcp.sensitive.replaceSecret, { proofId, ...encrypted });
  },
});
export const revoke = mutation({
  args: { proofId: v.id("mcpStepUps") },
  handler: async (ctx, args) => {
    const { credential, user, proof } = await requireProof(ctx, args.proofId, "revoke");
    await ctx.db.patch(proof._id, { consumed: true });
    await ctx.db.patch(credential._id, { status: "revoked", revision: credential.revision + 1 });
    await audit(ctx, credential, user._id, "revoke");
  },
});
export const remove = mutation({
  args: { proofId: v.id("mcpStepUps") },
  handler: async (ctx, args) => {
    const { credential, user, proof } = await requireProof(ctx, args.proofId, "delete");
    const secret = await ctx.db
      .query("mcpSecrets")
      .withIndex("by_credential", (q) => q.eq("credentialId", credential._id))
      .unique();
    await ctx.db.patch(proof._id, { consumed: true });
    await ctx.db.patch(credential._id, { status: "deleted", revision: credential.revision + 1 });
    if (secret) await ctx.db.delete(secret._id);
    await audit(ctx, credential, user._id, "delete");
  },
});
