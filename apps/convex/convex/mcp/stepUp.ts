import { ConvexError, v } from "convex/values";
import { isAPIError } from "better-auth/api";
import { mutation } from "../_generated/server";
import { authComponent, createAuth } from "../better_auth";
import { requireSensitive } from "./sensitiveAccess";
import { operation } from "./schema";
import { audit } from "./access";
import { clearPasswordAttempts, reservePasswordAttempt } from "../identity/password/policy";

export const verify = mutation({
  args: { credentialId: v.id("mcpCredentials"), operation, password: v.string() },
  handler: async (ctx, args) => {
    const { credential, user, sessionId, expiresAt } = await requireSensitive(ctx, args.credentialId, args.operation);
    const { auth, headers } = await authComponent.getAuth(createAuth, ctx);
    const { adapter, password } = await auth.$context;
    if (args.password.length > password.config.maxPasswordLength)
      throw new ConvexError("Password exceeds the account policy limit.");
    const attemptKey = await reservePasswordAttempt(adapter, user._id);
    if (!attemptKey) {
      await audit(ctx, credential, user._id, `${args.operation}_denied`);
      return null;
    }
    try {
      await auth.api.verifyPassword({ headers, body: { password: args.password } });
    } catch (error) {
      if (!isAPIError(error)) throw error;
      if (error.body?.code !== "INVALID_PASSWORD") throw new ConvexError(error.message);
      // A failed proof returns without throwing so its audit record commits.
      await audit(ctx, credential, user._id, `${args.operation}_denied`);
      return null;
    }
    await clearPasswordAttempts(adapter, attemptKey);
    const proofId = await ctx.db.insert("mcpStepUps", {
      credentialId: credential._id,
      operation: args.operation,
      actorId: user._id,
      sessionId,
      credentialRevision: credential.revision,
      expiresAt: Math.min(Date.now() + 120000, expiresAt),
      consumed: false,
    });
    await audit(ctx, credential, user._id, `${args.operation}_verified`);
    return proofId;
  },
});
