import { preferences } from "./preferences_fields";
import { oauthSettings, oauthProviderIds } from "./oauth/config";
import { defineTable, ROUTABLE_HTTP_METHODS } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";
import { z } from "zod/v4";
import { convexToZod, zodToConvexFields, zodToConvex } from "convex-helpers/server/zod4";

export const apiIdSchema = z.uuid();
export const instanceGeneral = z.object({
  instanceName: z.string().trim().min(1).max(255),
  telemetryEnabled: z.boolean(),
});
export const instanceAuthentication = z.object({
  signupEnabled: z.boolean(),
  passwordEnabled: z.boolean(),
  magicEnabled: z.boolean(),
  providers: z.record(z.enum(oauthProviderIds), z.boolean()),
});
export const instanceAuthenticationPatch = instanceAuthentication.partial().extend({
  providers: z.partialRecord(z.enum(oauthProviderIds), z.boolean()).optional(),
});
export const instanceIdentifier = z.string().regex(/^[0-9a-f]{24}$/);

// Safe request metadata only. HEAD is served by Convex through its GET handler.
export const apiRequestMetadata = z.object({
  pathname: z.string().startsWith("/").max(255),
  method: z.enum([...ROUTABLE_HTTP_METHODS, "HEAD"]),
  status: z.int().min(100).max(599),
  durationMs: z.number().finite().nonnegative(),
  userId: convexToZod(v.id("users")).nullable(),
  keyId: z.string().min(1).max(255).nullable(),
});
export const apiRequestFields = zodToConvexFields(apiRequestMetadata.shape);

export const lastLoginMedium = v.union(
  v.literal("email"),
  v.literal("magic-code"),
  ...oauthProviderIds.map((provider) => v.literal(provider))
);

export const profileFields = {
  firstName: v.string(),
  lastName: v.string(),
  timezone: v.string(),
};
export const identityTables = {
  apiRequestLogs: defineTable(apiRequestFields),
  users: defineTable({
    ...authTables.users.validator.fields,
    apiId: zodToConvex(apiIdSchema),
  })
    .index("email", ["email"])
    .index("phone", ["phone"])
    .index("by_api_id", ["apiId"]),
  betterAuthLinks: defineTable({
    authId: v.string(),
    userId: v.id("users"),
    lastLoginMedium: v.optional(lastLoginMedium),
    lastLoginAt: v.optional(v.number()),
  })
    .index("by_auth_id", ["authId"])
    .index("by_user", ["userId"]),
  emailChangeNotices: defineTable({
    userId: v.id("users"),
    recipient: v.string(),
    attempts: v.number(),
    status: v.union(v.literal("pending"), v.literal("sent"), v.literal("failed")),
  }),
  emailChangeChallenges: defineTable({
    userId: v.id("users"),
    sessionId: v.id("authSessions"),
    oldEmail: v.string(),
    newEmail: v.string(),
    nonce: v.string(),
    digest: v.string(),
    expiresAt: v.number(),
    attempts: v.number(),
    issuedAt: v.number(),
    windowStart: v.number(),
    issuedCount: v.number(),
    active: v.boolean(),
  }).index("by_user", ["userId"]),
  userAppearance: defineTable({
    userId: v.id("users"),
    avatarAssetId: v.union(v.id("assets"), v.null()),
    coverAssetId: v.optional(v.union(v.id("assets"), v.null())),
    externalCoverUrl: v.optional(v.string()),
  }).index("by_user", ["userId"]),
  instanceAuthority: defineTable({
    key: v.literal("instance"),
    initializedAt: v.number(),
    authentication: zodToConvex(instanceAuthentication.optional()),
    workspaceCreationDisabled: v.optional(v.boolean()),
    oauth: zodToConvex(oauthSettings.optional()),
    ...zodToConvexFields(instanceGeneral.shape),
    instanceId: zodToConvex(instanceIdentifier),
    revision: v.number(),
  }).index("by_key", ["key"]),
  instanceAdmins: defineTable({
    instanceId: v.id("instanceAuthority"),
    userId: v.id("users"),
    role: v.literal("admin"),
    revision: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_instance", ["instanceId"]),
  accountRestrictions: defineTable({ userId: v.id("users"), deactivatedAt: v.number() }).index("by_user", ["userId"]),
  userProfiles: defineTable({
    userId: v.id("users"),
    ...profileFields,
    marketingEmailConsent: v.optional(v.boolean()),
    preferences,
    revision: v.number(),
  }).index("by_user", ["userId"]),
};
