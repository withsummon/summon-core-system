import { accountSessionCleanup } from "./sessions";
import { ConvexError, v } from "convex/values";
import { action, internalMutation, query } from "../../_generated/server";
import type { Doc } from "../../_generated/dataModel";
import { internal } from "../../_generated/api";
import { requireIdentity } from "../session";
import { collectAccountProof, verifyAccountProof } from "./proof";
import { mailConfiguration } from "../mail/config";
import { oauthConfigurations } from "../oauth/config";
function usable(account: Doc<"authAccounts">, user: Doc<"users">) {
  if (account.provider === "password") return Boolean(account.secret);
  if (!user.email || user.emailVerificationTime === undefined || account.emailVerified !== user.email) return false;
  if (account.provider === "summon-magic")
    return account.providerAccountId === user.email && mailConfiguration(process.env) !== null;
  return oauthConfigurations(process.env).some((config) => config.id === account.provider);
}
export const commit = internalMutation({
  args: {
    targetId: v.id("authAccounts"),
    sessionId: v.id("authSessions"),
    accountId: v.optional(v.id("authAccounts")),
    expectedSecret: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { user, session } = await requireIdentity(ctx);
    if (session._id !== args.sessionId) throw new ConvexError("Sign-in changed. Try again.");
    await verifyAccountProof(ctx, user._id, session, args);
    const target = await ctx.db.get(args.targetId);
    if (!target || target.userId !== user._id) throw new ConvexError("Connected account not found.");
    const accounts = await ctx.db
      .query("authAccounts")
      .withIndex("userIdAndProvider", (q) => q.eq("userId", user._id))
      .take(101);
    if (accounts.length > 100) throw new ConvexError("Account cleanup exceeds the atomic budget.");
    if (!accounts.some((account) => account._id !== target._id && usable(account, user)))
      throw new ConvexError("Keep another configured, verified sign-in method before disconnecting this account.");
    const codes = await ctx.db
      .query("authVerificationCodes")
      .withIndex("accountId", (q) => q.eq("accountId", target._id))
      .take(101);
    if (codes.length > 100) throw new ConvexError("Verification code cleanup exceeds the atomic budget.");
    const cleanup = await accountSessionCleanup(ctx, user._id);
    await Promise.all([...codes, ...cleanup].map((row) => ctx.db.delete(row._id)));
    await ctx.db.delete(target._id);
  },
});
export const disconnect = action({
  args: { targetId: v.id("authAccounts"), password: v.optional(v.string()) },
  handler: async (ctx, args): Promise<void> => {
    const proof = await collectAccountProof(ctx, args.password);
    await ctx.runMutation(internal.identity.accounts.unlink.commit, { targetId: args.targetId, ...proof });
  },
});

export const options = query({
  args: {},
  handler: async (ctx) => {
    const { user } = await requireIdentity(ctx);
    const accounts = await ctx.db
      .query("authAccounts")
      .withIndex("userIdAndProvider", (q) => q.eq("userId", user._id))
      .take(101);
    const withinBudget = accounts.length <= 100;
    return {
      requiresPassword: accounts.some((account) => account.provider === "password"),
      accounts: accounts.slice(0, 100).map((account) => ({
        id: account._id,
        canDisconnect: withinBudget && accounts.some((other) => other._id !== account._id && usable(other, user)),
      })),
      withinBudget,
    };
  },
});
