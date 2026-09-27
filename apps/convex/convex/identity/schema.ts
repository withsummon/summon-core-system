import { preferences } from "./preferences_fields";
import { defineTable } from "convex/server";
import { v } from "convex/values";

export const profileFields = {
  firstName: v.string(),
  lastName: v.string(),
  timezone: v.string(),
};
export const identityTables = {
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
  userAppearance: defineTable({ userId: v.id("users"), avatarAssetId: v.union(v.id("assets"), v.null()) }).index(
    "by_user",
    ["userId"]
  ),
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
    preferences,
    revision: v.number(),
  }).index("by_user", ["userId"]),
};
