import { requireNotInstanceAdmin } from "./instance";
import { ConvexError, v } from "convex/values";
import { retrieveAccount } from "@convex-dev/auth/server";
import type { MutationCtx } from "../../_generated/server";
import type { Doc, Id } from "../../_generated/dataModel";
import { action, internalMutation } from "../../_generated/server";
import { internal } from "../../_generated/api";
import { requireIdentity } from "../session";
import { requireSafeAuthLogging } from "../password/policy";
import { requireAnotherAdmin } from "../../workspaces/index";
import { requireAnotherProjectAdmin } from "../access";
async function verifyDeactivationProof(
  ctx: MutationCtx,
  userId: Id<"users">,
  session: Doc<"authSessions">,
  args: { accountId?: Id<"authAccounts">; expectedSecret?: string }
) {
  const passwords = await ctx.db
    .query("authAccounts")
    .withIndex("userIdAndProvider", (q) => q.eq("userId", userId).eq("provider", "password"))
    .take(2);
  if (passwords.length) {
    if (
      passwords.length !== 1 ||
      passwords[0]._id !== args.accountId ||
      !args.expectedSecret ||
      passwords[0].secret !== args.expectedSecret
    )
      throw new ConvexError("Password changed. Verify your current password again.");
  } else if (args.accountId || Date.now() - session._creationTime > 5 * 60 * 1000) {
    throw new ConvexError("Sign in again before deactivating your account.");
  }
}
export const commit = internalMutation({
  args: {
    sessionId: v.id("authSessions"),
    accountId: v.optional(v.id("authAccounts")),
    expectedSecret: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { user, session } = await requireIdentity(ctx);
    if (session._id !== args.sessionId) throw new ConvexError("Sign-in changed. Try again.");
    await verifyDeactivationProof(ctx, user._id, session, args);
    await requireNotInstanceAdmin(ctx, user._id);
    const workspaces = await ctx.db
      .query("workspaceMembers")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .take(101);
    const projects = await ctx.db
      .query("projectMembers")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .take(101);
    const sessions = await ctx.db
      .query("authSessions")
      .withIndex("userId", (q) => q.eq("userId", user._id))
      .take(101);
    if (workspaces.length > 100 || projects.length > 100 || sessions.length > 100)
      throw new ConvexError("Account exceeds the atomic deactivation budget. No changes were made.");
    const tokens = [];
    for (const row of sessions) {
      // Sequential reads enforce the aggregate token budget before loading more rows.
      // eslint-disable-next-line no-await-in-loop
      const page = await ctx.db
        .query("authRefreshTokens")
        .withIndex("sessionId", (q) => q.eq("sessionId", row._id))
        .take(1001 - tokens.length);
      tokens.push(...page);
      if (tokens.length > 1000)
        throw new ConvexError("Session token cleanup exceeds the atomic budget. No changes were made.");
    }
    for (const row of workspaces)
      if (row.active && row.role === "admin") await requireAnotherAdmin(ctx, row.workspaceId);
    for (const row of projects)
      if (row.active && row.role === "admin") await requireAnotherProjectAdmin(ctx, row.projectId);
    await ctx.db.insert("accountRestrictions", { userId: user._id, deactivatedAt: Date.now() });
    for (const row of [...workspaces, ...projects]) if (row.active) await ctx.db.patch(row._id, { active: false });
    await Promise.all([...tokens, ...sessions].map((row) => ctx.db.delete(row._id)));
  },
});
export const deactivate = action({
  args: { password: v.optional(v.string()) },
  handler: async (ctx, args): Promise<void> => {
    requireSafeAuthLogging();
    const current = await ctx.runQuery(internal.identity.password.index.account, {});
    if (!current.account) {
      await ctx.runMutation(internal.identity.deactivation.index.commit, { sessionId: current.sessionId });
      return;
    }
    if (!args.password || args.password.length > 1024) throw new ConvexError("Current password is required.");
    const verified = await retrieveAccount(ctx, {
      provider: "password",
      account: { id: current.account.identifier, secret: args.password },
    });
    if (verified.user._id !== current.userId || verified.account._id !== current.account.id || !verified.account.secret)
      throw new ConvexError("Password account changed.");
    await ctx.runMutation(internal.identity.deactivation.index.commit, {
      sessionId: current.sessionId,
      accountId: verified.account._id,
      expectedSecret: verified.account.secret,
    });
  },
});
