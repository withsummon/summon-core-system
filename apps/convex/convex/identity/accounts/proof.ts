import { ConvexError } from "convex/values";
import { retrieveAccount } from "@convex-dev/auth/server";
import type { MutationCtx, ActionCtx } from "../../_generated/server";
import type { Doc, Id } from "../../_generated/dataModel";
import { internal } from "../../_generated/api";
import { requireSafeAuthLogging } from "../password/policy";
export async function verifyAccountProof(
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
    throw new ConvexError("Sign in again before changing connected accounts.");
  }
}
export async function collectAccountProof(
  ctx: ActionCtx,
  password?: string
): Promise<{ sessionId: Id<"authSessions">; accountId?: Id<"authAccounts">; expectedSecret?: string }> {
  requireSafeAuthLogging();
  const current = await ctx.runQuery(internal.identity.password.index.account, {});
  if (!current.account) return { sessionId: current.sessionId };
  if (!password || password.length > 1024) throw new ConvexError("Current password is required.");
  const verified = await retrieveAccount(ctx, {
    provider: "password",
    account: { id: current.account.identifier, secret: password },
  });
  if (verified.user._id !== current.userId || verified.account._id !== current.account.id || !verified.account.secret)
    throw new ConvexError("Password account changed.");
  return { sessionId: current.sessionId, accountId: verified.account._id, expectedSecret: verified.account.secret };
}
