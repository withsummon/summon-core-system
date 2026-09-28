import { isAPIError } from "better-auth/api";
import { paginationOptsValidator } from "convex/server";
import { ConvexError, v } from "convex/values";
import { components } from "../_generated/api";
import { internalMutation, mutation, query } from "../_generated/server";
import { authComponent, createAuth } from "../better_auth";
import { pageBudget, text } from "../commercial/validation";
import { accountRestricted } from "./deactivation/access";
import { requireUser } from "./session";

export const list = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    await requireUser(ctx);
    const authUser = await authComponent.getAuthUser(ctx);
    return ctx.runQuery(components.betterAuth.adapter.listApiKeys, {
      referenceId: authUser._id,
      paginationOpts: pageBudget(args.paginationOpts),
    });
  },
});

export const create = mutation({
  args: { name: v.string(), description: v.string(), expiresAt: v.union(v.number(), v.null()) },
  handler: async (ctx, args) => {
    await requireUser(ctx);
    const { auth, headers } = await authComponent.getAuth(createAuth, ctx);
    const name = text(args.name, "Name", 255, true);
    const metadata = { description: args.description };
    try {
      const token = await auth.api.createApiKey({
        headers,
        body: {
          name,
          metadata,
          expiresIn: args.expiresAt === null ? null : Math.ceil((args.expiresAt - Date.now()) / 1000),
        },
      });
      return {
        id: token.id,
        key: token.key,
        name,
        metadata,
        expiresAt: token.expiresAt === null ? null : Number(token.expiresAt),
      };
    } catch (error) {
      if (isAPIError(error)) throw new ConvexError(error.message);
      throw error;
    }
  },
});

export const revoke = mutation({
  args: { keyId: v.string() },
  handler: async (ctx, body) => {
    await requireUser(ctx);
    const { auth, headers } = await authComponent.getAuth(createAuth, ctx);
    try {
      return await auth.api.deleteApiKey({ headers, body });
    } catch (error) {
      if (isAPIError(error)) throw new ConvexError(error.message);
      throw error;
    }
  },
});

// HTTP transports must consume this boundary once per request. A token grants its
// current app user identity; every resource still enforces native membership.
export const verify = internalMutation({
  args: { key: v.string() },
  handler: async (ctx, body) => {
    const auth = createAuth(ctx);
    const verified = await auth.api.verifyApiKey({ body });
    const invalid = auth.$ERROR_CODES.INVALID_API_KEY;
    if (!verified.valid || !verified.key) {
      const denial = verified.error?.code === "RATE_LIMITED" ? auth.$ERROR_CODES.RATE_LIMIT_EXCEEDED : invalid;
      throw new ConvexError({ code: denial.code, message: denial.message });
    }
    const token = verified.key;
    const authUser = await authComponent.getAnyUserById(ctx, token.referenceId);
    const link = await ctx.db
      .query("betterAuthLinks")
      .withIndex("by_auth_id", (q) => q.eq("authId", token.referenceId))
      .unique();
    const user = link && (await ctx.db.get(link.userId));
    if (
      !authUser?.emailVerified ||
      !user ||
      user.email !== authUser.email ||
      user.emailVerificationTime === undefined ||
      (await accountRestricted(ctx, user._id))
    )
      throw new ConvexError({ code: invalid.code, message: invalid.message });
    return { userId: user._id, keyId: token.id };
  },
});
