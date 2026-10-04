import { revokeProjectMembership } from "../../projects/index";
import { ConvexError, v } from "convex/values";
import { isAPIError } from "better-auth/api";
import { mutation, type MutationCtx } from "../../_generated/server";
import type { Id } from "../../_generated/dataModel";
import { authComponent, createAuth } from "../../better_auth";
import { requireUser } from "../session";
import { requireNotInstanceAdmin } from "../instance/index";
import { requireAnotherWorkspaceAdmin } from "../access";
import { clearPasswordAttempts, reservePasswordAttempt } from "../password/policy";

export async function deactivateAccount(ctx: MutationCtx, userId: Id<"users">) {
  await requireNotInstanceAdmin(ctx, userId);
  const workspaces = await ctx.db
    .query("workspaceMembers")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .take(101);
  const projects = await ctx.db
    .query("projectMembers")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .take(101);
  if (workspaces.length > 100 || projects.length > 100)
    throw new ConvexError("Account exceeds the atomic deactivation budget. No changes were made.");
  for (const row of workspaces)
    if (row.active && row.role === "admin") await requireAnotherWorkspaceAdmin(ctx, row.workspaceId);
  await ctx.db.insert("accountRestrictions", { userId, deactivatedAt: Date.now() });
  for (const row of workspaces) if (row.active) await ctx.db.patch(row._id, { active: false });
  for (const row of projects) {
    // oxlint-disable-next-line no-await-in-loop
    await revokeProjectMembership(ctx, row);
  }
}

// Native HTTP deletion is disabled: component deletion and the application
// ownership checks must commit together inside this Convex transaction.
export const deactivate = mutation({
  args: { password: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const authUser = await authComponent.getAuthUser(ctx);
    const { auth, headers } = await authComponent.getAuth(createAuth, ctx);
    const { adapter, internalAdapter, password } = await auth.$context;
    if (args.password && args.password.length > password.config.maxPasswordLength)
      throw new ConvexError("Password exceeds the account policy limit.");
    const accounts = await internalAdapter.findAccounts(authUser._id);
    const requiresPassword = accounts.some((account) => account.providerId === "credential" && account.password);
    if (!args.password && requiresPassword) throw new ConvexError("Current password is required.");
    const attemptKey = requiresPassword ? await reservePasswordAttempt(adapter, user._id) : null;
    if (requiresPassword && !attemptKey) {
      const error = auth.$ERROR_CODES.TOO_MANY_ATTEMPTS;
      return { code: error.code, message: error.message };
    }
    try {
      await auth.api.deleteUser({ headers, body: args });
    } catch (error) {
      if (isAPIError(error) && error.body?.code === "INVALID_PASSWORD") {
        const denial = auth.$ERROR_CODES.INVALID_PASSWORD;
        return { code: denial.code, message: denial.message };
      }
      if (isAPIError(error)) throw new ConvexError(error.message);
      throw error;
    }
    if (attemptKey) await clearPasswordAttempts(adapter, attemptKey);
    return null;
  },
});
