import { preferences } from "./preferences_fields";
import { defineTable } from "convex/server";
import { v } from "convex/values";

export const profileFields = {
  firstName: v.string(),
  lastName: v.string(),
  timezone: v.string(),
};
export const identityTables = {
  userProfiles: defineTable({
    userId: v.id("users"),
    ...profileFields,
    preferences: v.optional(preferences),
    revision: v.number(),
  }).index("by_user", ["userId"]),
};
