import { createApi } from "@convex-dev/better-auth";
import { paginationOptsValidator, paginationResultValidator } from "convex/server";
import { paginator } from "convex-helpers/server/pagination";
import { v } from "convex/values";
import { z } from "zod";
import { query } from "./_generated/server";
import authConfig from "../auth.config";
import type { BetterAuthOptions } from "better-auth/minimal";
import { convex, crossDomain } from "@convex-dev/better-auth/plugins";
import { apiKey } from "@better-auth/api-key";
import schema from "./schema";

export const siteUrl = process.env.SITE_URL ?? "";

// Static options own the native database schema and are shared by the runtime.
export const authOptions = {
  baseURL: process.env.CONVEX_SITE_URL,
  trustedOrigins: [siteUrl],
  rateLimit: { enabled: true, storage: "database", customRules: { "/convex/jwks": false } },
  session: { freshAge: 300 },
  user: { deleteUser: { enabled: true } },
  // Public unlink is disabled; the canonical disconnect mutation owns the live method floor.
  account: { accountLinking: { allowUnlinkingAll: true } },
  disabledPaths: [
    "/delete-user",
    "/delete-user/callback",
    "/unlink-account",
    "/change-password",
    "/verify-password",
    "/update-user",
    "/api-key/create",
    "/api-key/list",
    "/api-key/get",
    "/api-key/update",
    "/api-key/delete",
  ],
  emailAndPassword: {
    // Native verification serves the current administrator exception; issuer hooks own policy.
    enabled: true,
    requireEmailVerification: true,
    minPasswordLength: 8,
    maxPasswordLength: 1024,
    revokeSessionsOnPasswordReset: true,
  },
  emailVerification: { sendOnSignUp: true, sendOnSignIn: true },
  plugins: [
    crossDomain({ siteUrl }),
    convex({ authConfig }),
    apiKey({
      defaultPrefix: "plane_api_",
      requireName: true,
      maximumNameLength: 255,
      enableMetadata: true,
      keyExpiration: { minExpiresIn: 0, maxExpiresIn: Infinity },
      rateLimit: { timeWindow: 60_000, maxRequests: 60 },
    }),
  ],
} satisfies BetterAuthOptions;

export const { create, findOne, findMany, updateOne, updateMany, deleteOne, deleteMany } = createApi(
  schema,
  () => authOptions
);

export const currentIdentity = query({
  args: { subject: v.string(), sessionId: v.string() },
  returns: v.union(
    v.null(),
    v.object({
      user: schema.doc("user"),
      sessionId: schema.id("session"),
      expiresAt: v.number(),
    })
  ),
  handler: async (ctx, { subject, sessionId }) => {
    const id = ctx.db.normalizeId("session", sessionId);
    const session = id && (await ctx.db.get(id));
    if (!session || session.userId !== subject || session.expiresAt <= Date.now()) return null;
    const userId = ctx.db.normalizeId("user", subject);
    const user = userId && (await ctx.db.get(userId));
    return user?.emailVerified ? { user, sessionId: session._id, expiresAt: session.expiresAt } : null;
  },
});

// Metadata is native JSON storage; parse it once where the row becomes public.
const metadata = z
  .string()
  .transform((value) => JSON.parse(value))
  .pipe(z.object({ description: z.string() }))
  .nullable()
  .optional();
const { key: _hashField, metadata: _metadataField, ...tokenFields } = schema.tables.apikey.validator.fields;

export const listApiKeys = query({
  args: { referenceId: v.string(), paginationOpts: paginationOptsValidator },
  returns: paginationResultValidator(
    v.object({
      ...tokenFields,
      _id: v.id("apikey"),
      _creationTime: v.number(),
      name: v.string(),
      enabled: v.boolean(),
      metadata: v.optional(v.union(v.null(), v.object({ description: v.string() }))),
    })
  ),
  handler: async (ctx, { referenceId, paginationOpts }) => {
    const result = await paginator(ctx.db, schema)
      .query("apikey")
      .withIndex("referenceId", (q) => q.eq("referenceId", referenceId))
      .order("desc")
      .paginate(paginationOpts);
    return {
      ...result,
      page: result.page.map(({ key: _hash, metadata: storedMetadata, ...token }) =>
        Object.assign(token, {
          name: z.string().min(1).parse(token.name),
          enabled: z.boolean().parse(token.enabled),
          metadata: metadata.parse(storedMetadata),
        })
      ),
    };
  },
});
