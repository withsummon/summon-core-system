import { ConvexError, v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { mutation, query } from "../_generated/server";
import { pageBudget } from "../commercial/validation";
import { requireLiveSession } from "./access";
const MAX_REFRESH_TOKENS = 1000;
export const list = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const { user, session } = await requireLiveSession(ctx);
    const result = await ctx.db
      .query("authSessions")
      .withIndex("userId", (q) => q.eq("userId", user._id))
      .order("desc")
      .paginate(pageBudget(args.paginationOpts));
    return {
      ...result,
      page: result.page.map((row) => ({
        id: row._id,
        createdAt: row._creationTime,
        expiresAt: row.expirationTime,
        isCurrent: row._id === session._id,
      })),
      revocationNotice:
        "Revocation prevents token renewal. An already issued access token may remain valid until it expires.",
    };
  },
});
export const revoke = mutation({
  args: { sessionId: v.id("authSessions") },
  handler: async (ctx, args) => {
    const { user, session: current } = await requireLiveSession(ctx);
    const target = await ctx.db.get(args.sessionId);
    // Absence is intentionally indistinguishable from an unowned session.
    if (!target || target.userId !== user._id) throw new ConvexError("Session not found.");
    // Convex Auth's deleteSession owner deletes this same indexed refresh chain.
    // Its helper is private; preserve the transaction contract without importing a private package path.
    const tokens = await ctx.db
      .query("authRefreshTokens")
      .withIndex("sessionIdAndParentRefreshTokenId", (q) => q.eq("sessionId", target._id))
      .take(MAX_REFRESH_TOKENS + 1);
    if (tokens.length > MAX_REFRESH_TOKENS)
      throw new ConvexError("This session exceeds the token cleanup limit. No session data was changed.");
    await Promise.all(tokens.map((token) => ctx.db.delete(token._id)));
    await ctx.db.delete(target._id);
    return { revokedCurrent: target._id === current._id };
  },
});
