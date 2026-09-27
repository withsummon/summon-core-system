import { getAuthSessionId, getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError } from "convex/values";
import type { QueryCtx } from "../_generated/server";
import { query } from "../_generated/server";
export async function liveIdentity(ctx: QueryCtx) {
  const userId = await getAuthUserId(ctx);
  const sessionId = await getAuthSessionId(ctx);
  if (!userId || !sessionId) return null;
  const session = await ctx.db.get(sessionId);
  if (!session || session.userId !== userId || session.expirationTime <= Date.now()) return null;
  const user = await ctx.db.get(userId);
  return user ? { user, session } : null;
}
export async function requireIdentity(ctx: QueryCtx) {
  const identity = await liveIdentity(ctx);
  if (!identity)
    throw new ConvexError({ code: "SESSION_EXPIRED", message: "Sign in again. Your session expired or was revoked." });
  return identity;
}
// This read remains available to a valid JWT whose backing session has been revoked.
export const status = query({
  args: {},
  handler: async (ctx) => {
    const identity = await liveIdentity(ctx);
    return identity ? { valid: true as const, expiresAt: identity.session.expirationTime } : { valid: false as const };
  },
});
