import { v, ConvexError } from "convex/values";
import { action, internalQuery, internalMutation } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { internal } from "../_generated/api";
import { retrieveAccount } from "@convex-dev/auth/server";
import { requireSensitive } from "./sensitiveAccess";
import { operation } from "./schema";
import { audit } from "./access";
export const account = internalQuery({
  args: { credentialId: v.id("mcpCredentials"), operation },
  handler: async (ctx, args) => {
    const { credential, user, session } = await requireSensitive(ctx, args.credentialId, args.operation);
    const accounts = await ctx.db
      .query("authAccounts")
      .withIndex("userIdAndProvider", (q) => q.eq("userId", user._id).eq("provider", "password"))
      .take(2);
    if (accounts.length !== 1) throw new ConvexError("Password verification is unavailable for this account.");
    return {
      accountId: accounts[0]._id,
      providerAccountId: accounts[0].providerAccountId,
      actorId: user._id,
      sessionId: session._id,
      credentialRevision: credential.revision,
    };
  },
});
export const issue = internalMutation({
  args: {
    credentialId: v.id("mcpCredentials"),
    operation,
    actorId: v.id("users"),
    sessionId: v.id("authSessions"),
    credentialRevision: v.number(),
  },
  handler: async (ctx, args) => {
    const { credential, user, session } = await requireSensitive(ctx, args.credentialId, args.operation);
    if (args.actorId !== user._id || args.sessionId !== session._id || args.credentialRevision !== credential.revision)
      throw new ConvexError("Credential or session changed during verification.");
    const proofId = await ctx.db.insert("mcpStepUps", {
      ...args,
      expiresAt: Math.min(Date.now() + 120000, session.expirationTime),
      consumed: false,
    });
    await audit(ctx, credential, user._id, `${args.operation}_verified`);
    return proofId;
  },
});
export const denied = internalMutation({
  args: { credentialId: v.id("mcpCredentials"), operation },
  handler: async (ctx, args) => {
    const { credential, user } = await requireSensitive(ctx, args.credentialId, args.operation);
    await audit(ctx, credential, user._id, `${args.operation}_denied`);
  },
});
export const verify = action({
  args: { credentialId: v.id("mcpCredentials"), operation, password: v.string() },
  handler: async (ctx, args): Promise<Id<"mcpStepUps">> => {
    const currentAccount = await ctx.runQuery(internal.mcp.stepUp.account, {
      credentialId: args.credentialId,
      operation: args.operation,
    });
    if (process.env.AUTH_LOG_LEVEL === "DEBUG" || process.env.AUTH_LOG_SECRETS === "true")
      throw new ConvexError("Disable authentication secret/debug logging before verifying sensitive operations.");
    try {
      if (!args.password || args.password.length > 1024) throw new Error("Invalid password.");
      const verified = await retrieveAccount(ctx, {
        provider: "password",
        account: { id: currentAccount.providerAccountId, secret: args.password },
      });
      if (verified.user._id !== currentAccount.actorId || verified.account._id !== currentAccount.accountId)
        throw new Error("Account mismatch.");
    } catch {
      await ctx.runMutation(internal.mcp.stepUp.denied, { credentialId: args.credentialId, operation: args.operation });
      throw new ConvexError("Password verification failed. Try again or sign in again.");
    }
    return ctx.runMutation(internal.mcp.stepUp.issue, {
      credentialId: args.credentialId,
      operation: args.operation,
      actorId: currentAccount.actorId,
      sessionId: currentAccount.sessionId,
      credentialRevision: currentAccount.credentialRevision,
    });
  },
});
