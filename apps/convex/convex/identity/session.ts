import { accountRestricted } from "./deactivation/access";
import { getAuthSessionId, getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError } from "convex/values";
import { components } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
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
export async function requireIdentity(
  ctx: QueryCtx
): Promise<{ user: Doc<"users">; sessionId: string; expiresAt: number }> {
  if (process.env.SUMMON_AUTH_ENGINE !== "better-auth") {
    const current = await liveIdentity(ctx);
    if (!current)
      throw new ConvexError({
        code: "SESSION_EXPIRED",
        message: "Sign in again. Your session expired or was revoked.",
      });
    return {
      user: current.user,
      sessionId: current.session._id,
      expiresAt: current.session.expirationTime,
    };
  }
  const identity = await ctx.auth.getUserIdentity();
  if (!identity || typeof identity.sessionId !== "string")
    throw new ConvexError({ code: "SESSION_EXPIRED", message: "Sign in again. Your session expired or was revoked." });
  const current = await ctx.runQuery(components.betterAuth.adapter.currentIdentity, {
    subject: identity.subject,
    sessionId: identity.sessionId,
  });
  if (!current)
    throw new ConvexError({ code: "SESSION_EXPIRED", message: "Sign in again. Your session expired or was revoked." });
  const authUser = current.user;
  const link = await ctx.db
    .query("betterAuthLinks")
    .withIndex("by_auth_id", (q) => q.eq("authId", authUser._id))
    .unique();
  const user = link && (await ctx.db.get(link.userId));
  if (!user || user.email !== authUser.email || user.emailVerificationTime === undefined)
    throw new ConvexError("Your account is unavailable.");
  if (await accountRestricted(ctx, user._id))
    throw new ConvexError({ code: "SESSION_EXPIRED", message: "Sign in again. Your session expired or was revoked." });
  return { user, sessionId: current.sessionId, expiresAt: current.expiresAt };
}
export async function requireUser(ctx: QueryCtx): Promise<Doc<"users">> {
  return (await requireIdentity(ctx)).user;
}
// Durable jobs retain their initiating account, never a session or forged auth context.
export async function requireAccountUser(ctx: QueryCtx, userId: Id<"users">) {
  const user = await ctx.db.get(userId);
  if (!user || (await accountRestricted(ctx, userId))) throw new ConvexError("Your account is unavailable.");
  return user;
}
// This read remains available to a valid JWT whose backing session has been revoked.
export const status = query({
  args: {},
  handler: async (ctx): Promise<{ valid: true; expiresAt: number } | { valid: false }> => {
    try {
      const { expiresAt } = await requireIdentity(ctx);
      return { valid: true, expiresAt };
    } catch (error) {
      if (error instanceof ConvexError) return { valid: false };
      throw error;
    }
  },
});
