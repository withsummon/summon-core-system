import { internal } from "../../_generated/api";
import { ConvexError, v } from "convex/values";
import { internalMutation, query } from "../../_generated/server";
import type { MutationCtx } from "../../_generated/server";
import type { Id } from "../../_generated/dataModel";
import { requireIdentity } from "../session";
import { verifyAccountProof } from "../accounts/proof";
import { accountSessionCleanup } from "../accounts/sessions";
import { mailConfiguration } from "../mail/config";
const proof = {
  sessionId: v.id("authSessions"),
  accountId: v.optional(v.id("authAccounts")),
  expectedSecret: v.optional(v.string()),
};
async function identity(
  ctx: MutationCtx,
  args: { sessionId: Id<"authSessions">; accountId?: Id<"authAccounts">; expectedSecret?: string }
) {
  const current = await requireIdentity(ctx);
  if (current.session._id !== args.sessionId) throw new ConvexError("Sign-in changed. Try again.");
  await verifyAccountProof(ctx, current.user._id, current.session, args);
  return current;
}
async function collision(ctx: MutationCtx, email: string, userId: Id<"users">) {
  const users = await ctx.db
    .query("users")
    .withIndex("email", (q) => q.eq("email", email))
    .take(2);
  if (users.some((user) => user._id !== userId)) throw new ConvexError("Email address is unavailable.");
  const accounts = await Promise.all(
    ["password", "summon-magic"].map((provider) =>
      ctx.db
        .query("authAccounts")
        .withIndex("providerAndAccountId", (q) => q.eq("provider", provider).eq("providerAccountId", email))
        .take(2)
    )
  );
  if (accounts.flat().some((account) => account.userId !== userId))
    throw new ConvexError("Email address is unavailable.");
}
export const availability = query({
  args: {},
  handler: async (ctx) => {
    await requireIdentity(ctx);
    return { available: mailConfiguration(process.env) !== null };
  },
});
export const begin = internalMutation({
  args: { ...proof, newEmail: v.string(), nonce: v.string(), digest: v.string() },
  handler: async (ctx, args) => {
    const { user } = await identity(ctx, args);
    if (!mailConfiguration(process.env)) throw new ConvexError("Account email delivery is not configured.");
    const email = args.newEmail.trim().toLowerCase();
    if (!user.email || email === user.email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      throw new ConvexError("Enter a different valid email address.");
    await collision(ctx, email, user._id);
    const previous = await ctx.db
      .query("emailChangeChallenges")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .unique();
    const now = Date.now();
    if (previous && now - previous.issuedAt < 60000)
      throw new ConvexError("Wait one minute before requesting another code.");
    const sameWindow = previous && now - previous.windowStart < 3600000;
    if (sameWindow && previous.issuedCount >= 3)
      throw new ConvexError("Try again after the hourly email limit resets.");
    const value = {
      userId: user._id,
      sessionId: args.sessionId,
      oldEmail: user.email,
      newEmail: email,
      nonce: args.nonce,
      digest: args.digest,
      expiresAt: now + 600000,
      attempts: 0,
      issuedAt: now,
      windowStart: sameWindow ? previous.windowStart : now,
      issuedCount: sameWindow ? previous.issuedCount + 1 : 1,
      active: true,
    };
    if (previous) await ctx.db.replace(previous._id, value);
    else await ctx.db.insert("emailChangeChallenges", value);
    return { email, nonce: args.nonce };
  },
});
export const fail = internalMutation({
  args: { nonce: v.string() },
  handler: async (ctx, args) => {
    const { user } = await requireIdentity(ctx);
    const row = await ctx.db
      .query("emailChangeChallenges")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .unique();
    if (row?.nonce === args.nonce) await ctx.db.patch(row._id, { active: false });
  },
});
export const commit = internalMutation({
  args: { ...proof, nonce: v.string(), digest: v.string() },
  handler: async (ctx, args) => {
    const { user } = await identity(ctx, args);
    const row = await ctx.db
      .query("emailChangeChallenges")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .unique();
    if (
      !row ||
      !row.active ||
      row.sessionId !== args.sessionId ||
      row.oldEmail !== user.email ||
      row.nonce !== args.nonce ||
      row.expiresAt <= Date.now() ||
      row.attempts >= 5
    )
      return { changed: false };
    if (row.digest !== args.digest) {
      await ctx.db.patch(row._id, { attempts: row.attempts + 1, active: row.attempts + 1 < 5 });
      return { changed: false };
    }
    await collision(ctx, row.newEmail, user._id);
    const accounts = await ctx.db
      .query("authAccounts")
      .withIndex("userIdAndProvider", (q) => q.eq("userId", user._id))
      .take(101);
    if (accounts.length > 100) throw new ConvexError("Account cleanup exceeds the atomic budget.");
    const addressed = accounts.filter(
      (account) => account.provider === "password" || account.provider === "summon-magic"
    );
    if (addressed.some((account) => account.providerAccountId !== row.oldEmail))
      throw new ConvexError("Account email changed. Sign in again.");
    const codes = (
      await Promise.all(
        accounts.map((account) =>
          ctx.db
            .query("authVerificationCodes")
            .withIndex("accountId", (q) => q.eq("accountId", account._id))
            .take(11)
        )
      )
    ).flat();
    if (
      codes.length > 100 ||
      accounts.some((account) => codes.filter((code) => code.accountId === account._id).length > 10)
    )
      throw new ConvexError("Verification cleanup exceeds the atomic budget.");
    const cleanup = await accountSessionCleanup(ctx, user._id);
    await Promise.all(
      addressed.map((account) =>
        ctx.db.patch(account._id, { providerAccountId: row.newEmail, emailVerified: row.newEmail })
      )
    );
    await ctx.db.patch(user._id, { email: row.newEmail, emailVerificationTime: Date.now() });
    await Promise.all([...codes, ...cleanup].map((record) => ctx.db.delete(record._id)));
    await ctx.db.patch(row._id, { active: false });
    await Promise.all(
      [row.oldEmail, row.newEmail].map(async (recipient) => {
        const id = await ctx.db.insert("emailChangeNotices", {
          userId: user._id,
          recipient,
          attempts: 0,
          status: "pending",
        });
        await ctx.scheduler.runAfter(0, internal.identity.emailChange.notifications.deliver, { id });
      })
    );
    return { changed: true };
  },
});
