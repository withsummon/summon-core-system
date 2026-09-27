import { preferences } from "./preferences_fields";
import { defineTable } from "convex/server";
import { v } from "convex/values";

export const profileFields = {
  firstName: v.string(),
  lastName: v.string(),
  timezone: v.string(),
};
export const identityTables = {
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
