import { preferences } from "./preferences_fields";
import { oauthProviderIds } from "./oauth/config";
import { defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";
import { z } from "zod/v4";
import { zodToConvex } from "convex-helpers/server/zod4";

export const userApiId = z.uuid();

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
  users: defineTable({
    ...authTables.users.validator.fields,
    apiId: zodToConvex(userApiId.optional()),
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
  instanceAuthority: defineTable({ key: v.literal("instance"), initializedAt: v.number() }).index("by_key", ["key"]),
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
