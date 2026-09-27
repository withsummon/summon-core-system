import { ConvexError } from "convex/values";
import type { MutationCtx } from "../../_generated/server";
import type { Id } from "../../_generated/dataModel";
export async function accountSessionCleanup(ctx: MutationCtx, userId: Id<"users">) {
  const sessions = await ctx.db
    .query("authSessions")
    .withIndex("userId", (q) => q.eq("userId", userId))
    .take(101);
  if (sessions.length > 100)
    throw new ConvexError("Account session cleanup exceeds the atomic budget. No changes were made.");
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
  return [...tokens, ...sessions];
}
