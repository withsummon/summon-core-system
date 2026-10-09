import { currentSignInPolicy } from "../signin_policy";
import { v, ConvexError } from "convex/values";
import { isAPIError } from "better-auth/api";
import { mutation, query } from "../../_generated/server";
import { authComponent, createAuth } from "../../better_auth";
import { requireUser } from "../session";
import { clearPasswordAttempts, reservePasswordAttempt } from "./policy";

export const capabilities = query({
  args: {},
  handler: async (ctx) => {
    await requireUser(ctx);
    const user = await authComponent.getAuthUser(ctx);
    const { internalAdapter } = await createAuth(ctx).$context;
    const accounts = await internalAdapter.findAccounts(user._id);
    const hasPassword = accounts.some((account) => account.providerId === "credential" && account.password);
    const policy = await currentSignInPolicy(ctx, { authId: user._id, email: user.email });
    return {
      requiresPassword: hasPassword,
      canChange: policy.password && hasPassword,
      canSet: policy.password && !hasPassword,
    };
  },
});

// Keep native credential verification, update, and session revocation in one
// transaction. The native HTTP endpoint rotates even the current session.
export const change = mutation({
  args: { currentPassword: v.string(), newPassword: v.string() },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const authUser = await authComponent.getAuthUser(ctx);
    if (!(await currentSignInPolicy(ctx, { authId: authUser._id, email: authUser.email })).password)
      throw new ConvexError("Password sign-in is disabled by the instance operator.");
    const { auth, headers } = await authComponent.getAuth(createAuth, ctx);
    const { adapter, password } = await auth.$context;
    if (args.currentPassword.length > password.config.maxPasswordLength)
      throw new ConvexError("Password exceeds the account policy limit.");
    const attemptKey = await reservePasswordAttempt(adapter, user._id);
    if (!attemptKey) {
      const error = auth.$ERROR_CODES.TOO_MANY_ATTEMPTS;
      return { code: error.code, message: error.message };
    }
    try {
      await auth.api.changePassword({ headers, body: { ...args, revokeOtherSessions: false } });
    } catch (error) {
      if (isAPIError(error) && error.body?.code === "INVALID_PASSWORD") {
        const denial = auth.$ERROR_CODES.INVALID_PASSWORD;
        return { code: denial.code, message: denial.message };
      }
      if (isAPIError(error)) throw new ConvexError(error.message);
      throw error;
    }
    await clearPasswordAttempts(adapter, attemptKey);
    await auth.api.revokeOtherSessions({ headers });
    return null;
  },
});

// Better Auth only exposes setPassword to trusted server callers.
export const set = mutation({
  args: { newPassword: v.string() },
  handler: async (ctx, args) => {
    await requireUser(ctx);
    const authUser = await authComponent.getAuthUser(ctx);
    if (!(await currentSignInPolicy(ctx, { authId: authUser._id, email: authUser.email })).password)
      throw new ConvexError("Password sign-in is disabled by the instance operator.");
    const { auth, headers } = await authComponent.getAuth(createAuth, ctx);
    try {
      await auth.api.setPassword({ headers, body: args });
    } catch (error) {
      if (isAPIError(error)) throw new ConvexError(error.message);
      throw error;
    }
  },
});
