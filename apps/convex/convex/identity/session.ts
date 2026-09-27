import { accountRestricted, requireUnrestrictedAccount } from "./deactivation/access";
import { getAuthSessionId, getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError } from "convex/values";
import { internal } from "../_generated/api";
import type { Doc } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { query } from "../_generated/server";
export async function liveIdentity(ctx: QueryCtx) {
  const userId = await getAuthUserId(ctx);
  const sessionId = await getAuthSessionId(ctx);
  if (!userId || !sessionId) return null;
  const session = await ctx.db.get(sessionId);
  if (!session || session.userId !== userId || session.expirationTime <= Date.now()) return null;
  const user = await ctx.db.get(userId);
  return user && !(await accountRestricted(ctx, userId)) ? { user, session } : null;
}
export async function requireIdentity(ctx: QueryCtx) {
  const identity = await liveIdentity(ctx);
  if (!identity)
    throw new ConvexError({ code: "SESSION_EXPIRED", message: "Sign in again. Your session expired or was revoked." });
  return identity;
}
export async function requireUser(ctx: QueryCtx): Promise<Doc<"users">> {
  if (process.env.SUMMON_AUTH_ENGINE !== "better-auth") return (await requireIdentity(ctx)).user;
  const authUser = await ctx.runQuery(internal.better_auth.sessionUser, {});
  if (!authUser?.emailVerified)
    throw new ConvexError({ code: "SESSION_EXPIRED", message: "Sign in again. Your session expired or was revoked." });
  const link = await ctx.db
    .query("betterAuthLinks")
    .withIndex("by_auth_id", (q) => q.eq("authId", authUser.id))
    .unique();
  const user = link && (await ctx.db.get(link.userId));
  if (!user || user.email !== authUser.email || user.emailVerificationTime === undefined)
    throw new ConvexError("Your account is unavailable.");
  await requireUnrestrictedAccount(ctx, user._id);
  return user;
}
// This read remains available to a valid JWT whose backing session has been revoked.
export const status = query({
  args: {},
  handler: async (ctx): Promise<{ valid: true; expiresAt: number } | { valid: false }> => {
    if (process.env.SUMMON_AUTH_ENGINE === "better-auth") {
      try {
        await requireUser(ctx);
        const expiresAt = await ctx.runQuery(internal.better_auth.sessionExpiry, {});
        return expiresAt && expiresAt > Date.now() ? { valid: true, expiresAt } : { valid: false };
      } catch (error) {
        if (error instanceof ConvexError) return { valid: false };
        throw error;
      }
    }
    const identity = await liveIdentity(ctx);
    return identity ? { valid: true as const, expiresAt: identity.session.expirationTime } : { valid: false as const };
  },
});
