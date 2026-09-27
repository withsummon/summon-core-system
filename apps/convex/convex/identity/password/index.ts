import { v, ConvexError } from "convex/values";
import { retrieveAccount, modifyAccountCredentials, createAccount } from "@convex-dev/auth/server";
import { action, internalQuery, query } from "../../_generated/server";
import type { QueryCtx } from "../../_generated/server";
import { internal } from "../../_generated/api";
import { requireIdentity } from "../session";
import { validatePassword, requireSafeAuthLogging } from "./policy";
async function currentAccount(ctx: QueryCtx) {
  const { user, session } = await requireIdentity(ctx);
  const accounts = await ctx.db
    .query("authAccounts")
    .withIndex("userIdAndProvider", (q) => q.eq("userId", user._id).eq("provider", "password"))
    .take(2);
  if (accounts.length > 1) throw new ConvexError("Password account is ambiguous.");
  return {
    userId: user._id,
    sessionId: session._id,
    email: user.email,
    emailVerificationTime: user.emailVerificationTime,
    account: accounts[0] ? { id: accounts[0]._id, identifier: accounts[0].providerAccountId } : null,
  };
}
export const account = internalQuery({ args: {}, handler: currentAccount });
export const capabilities = query({
  args: {},
  handler: async (ctx) => {
    const current = await currentAccount(ctx);
    return {
      canChange: current.account !== null,
      canSet: current.account === null && current.email !== undefined && current.emailVerificationTime !== undefined,
    };
  },
});
export const change = action({
  args: { oldPassword: v.string(), newPassword: v.string() },
  handler: async (ctx, args): Promise<void> => {
    requireSafeAuthLogging();
    validatePassword(args.newPassword);
    if (!args.oldPassword || args.oldPassword.length > 1024) throw new ConvexError("Current password is required.");
    const current = await ctx.runQuery(internal.identity.password.index.account, {});
    if (!current.account) throw new ConvexError("No password is set for this account.");
    let verified;
    try {
      verified = await retrieveAccount(ctx, {
        provider: "password",
        account: { id: current.account.identifier, secret: args.oldPassword },
      });
    } catch {
      throw new ConvexError("Current password could not be verified.");
    }
    if (verified.user._id !== current.userId || verified.account._id !== current.account.id || !verified.account.secret)
      throw new ConvexError("Password account changed.");
    // Capture the exact hash verified above. Never reread a newer hash after verification.
    await modifyAccountCredentials(ctx, {
      provider: "password",
      account: { id: current.account.identifier, secret: args.newPassword },
      sessionGuard: {
        userId: current.userId,
        sessionId: current.sessionId,
        accountId: verified.account._id,
        expectedSecret: verified.account.secret,
      },
    });
  },
});
export const set = action({
  args: { newPassword: v.string() },
  handler: async (ctx, args): Promise<void> => {
    requireSafeAuthLogging();
    validatePassword(args.newPassword);
    const current = await ctx.runQuery(internal.identity.password.index.account, {});
    if (current.account || !current.email || current.emailVerificationTime === undefined)
      throw new ConvexError("A verified account without a password is required.");
    await createAccount(ctx, {
      provider: "password",
      account: { id: current.email, secret: args.newPassword },
      profile: { email: current.email, emailVerificationTime: current.emailVerificationTime },
      shouldLinkViaEmail: true,
      sessionGuard: { userId: current.userId, sessionId: current.sessionId },
    });
  },
});
