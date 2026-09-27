import { getAuthSessionId } from "@convex-dev/auth/server";
import { ConvexError } from "convex/values";
import type { QueryCtx } from "../_generated/server";
import { requireUser } from "../identity/access";
export async function requireLiveSession(ctx: QueryCtx) {
  const user = await requireUser(ctx);
  const sessionId = await getAuthSessionId(ctx);
  if (!sessionId) throw new ConvexError("Sign in again to manage sessions.");
  const session = await ctx.db.get(sessionId);
  if (!session || session.userId !== user._id || session.expirationTime <= Date.now())
    throw new ConvexError("Your session expired. Sign in again.");
  return { user, session };
}
