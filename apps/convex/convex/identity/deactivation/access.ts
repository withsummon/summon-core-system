import { ConvexError } from "convex/values";
import type { QueryCtx } from "../../_generated/server";
import type { Id } from "../../_generated/dataModel";
// Absence is the existing unrestricted-account contract, not a migration fallback.
export async function accountRestricted(ctx: QueryCtx, userId: Id<"users">) {
  return (
    (await ctx.db
      .query("accountRestrictions")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique()) !== null
  );
}
export async function requireUnrestrictedAccount(ctx: QueryCtx, userId: Id<"users">) {
  if (await accountRestricted(ctx, userId)) throw new ConvexError("This account is deactivated.");
}
