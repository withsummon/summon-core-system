import { z } from "zod/v4";
import { isAPIError } from "better-auth/api";
import { paginationOptsValidator } from "convex/server";
import { ConvexError, v } from "convex/values";
import { components, internal } from "../_generated/api";
import type { ActionCtx, MutationCtx } from "../_generated/server";
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
async function verifyKey(ctx: MutationCtx, key: string) {
  const auth = createAuth(ctx);
  const verified = await auth.api.verifyApiKey({ body: { key } });
  const invalid = auth.$ERROR_CODES.INVALID_API_KEY;
  const headers: Record<string, string> = {};
  if (!verified.valid || !verified.key) {
    const limited = verified.error?.code === "RATE_LIMITED";
    const denial = limited ? auth.$ERROR_CODES.RATE_LIMIT_EXCEEDED : invalid;
    if (limited) {
      // The installed plugin returns this detail; its public error type omits it.
      const retry = z
        .object({ details: z.object({ tryAgainIn: z.number().finite().nonnegative() }) })
        .parse(verified.error);
      headers["Retry-After"] = String(Math.ceil(retry.details.tryAgainIn / 1000));
    }
    return { status: limited ? (429 as const) : (403 as const), detail: denial.message, headers };
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
    return { status: 403 as const, detail: invalid.message, headers };
  if (
    token.rateLimitEnabled &&
    token.rateLimitMax !== null &&
    token.rateLimitTimeWindow !== null &&
    token.lastRequest !== null
  ) {
    headers["X-RateLimit-Remaining"] = String(Math.max(0, token.rateLimitMax - token.requestCount));
    headers["X-RateLimit-Reset"] = String(Math.floor((Number(token.lastRequest) + token.rateLimitTimeWindow) / 1000));
  }
  return { status: 200 as const, userId: user._id, headers };
}
export const verify = internalMutation({
  args: { key: v.string() },
  handler: (ctx, { key }) => verifyKey(ctx, key),
});
export const externalApiHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "X-Api-Key",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Expose-Headers": "X-RateLimit-Remaining, X-RateLimit-Reset, Retry-After",
  "Cache-Control": "private, no-store",
};
export async function verifyRequest(ctx: ActionCtx, request: Request): Promise<Awaited<ReturnType<typeof verifyKey>>> {
  const key = request.headers.get("X-Api-Key");
  if (!key) return { status: 403, detail: "Authentication credentials were not provided.", headers: {} };
  return ctx.runMutation(internal.identity.apiTokens.verify, { key });
}
