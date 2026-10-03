import { ConvexError, v } from "convex/values";
import { isAPIError } from "better-auth/api";
import { mutation } from "../../_generated/server";
import { authComponent, createAuth } from "../../better_auth";
import { requireUser } from "../session";
import { signInPolicy } from "../signin_policy";
import { nativeOAuthProviders } from "../oauth/providers";
import { clearPasswordAttempts, reservePasswordAttempt } from "../password/policy";

export const disconnect = mutation({
  args: { providerId: v.string(), accountId: v.string(), password: v.optional(v.string()) },
  handler: async (ctx, { password, ...account }) => {
    const user = await requireUser(ctx);
    const authUser = await authComponent.getAuthUser(ctx);
    const { auth, headers } = await authComponent.getAuth(createAuth, ctx);
    const { adapter, internalAdapter, password: passwordPolicy } = await auth.$context;
    if (password && password.length > passwordPolicy.config.maxPasswordLength)
      throw new ConvexError("Password exceeds the account policy limit.");
    const accounts = await internalAdapter.findAccounts(authUser._id);
    const policy = signInPolicy(process.env);
    const configured = new Set(nativeOAuthProviders(process.env).map((provider) => provider.providerId));
    if (
      !policy.magic &&
      !accounts.some(
        (other) =>
          !(other.providerId === account.providerId && other.accountId === account.accountId) &&
          (other.providerId === "credential"
            ? policy.password && Boolean(other.password)
            : configured.has(other.providerId))
      )
    )
      throw new ConvexError("Keep another configured, verified sign-in method before disconnecting this account.");
    if (accounts.some((other) => other.providerId === "credential" && other.password)) {
      if (!password) throw new ConvexError("Current password is required.");
      const attemptKey = await reservePasswordAttempt(adapter, user._id);
      if (!attemptKey) {
        const error = auth.$ERROR_CODES.TOO_MANY_ATTEMPTS;
        return { code: error.code, message: error.message };
      }
      try {
        await auth.api.verifyPassword({ headers, body: { password } });
      } catch (error) {
        if (isAPIError(error) && error.body?.code === "INVALID_PASSWORD") {
          const denial = auth.$ERROR_CODES.INVALID_PASSWORD;
          return { code: denial.code, message: denial.message };
        }
        if (isAPIError(error)) throw new ConvexError(error.message);
        throw error;
      }
      await clearPasswordAttempts(adapter, attemptKey);
    }
    try {
      await auth.api.unlinkAccount({ headers, body: account });
      await auth.api.revokeSessions({ headers });
    } catch (error) {
      if (isAPIError(error)) throw new ConvexError(error.message);
      throw error;
    }
    return null;
  },
});
