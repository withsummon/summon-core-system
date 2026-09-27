import { defineTable } from "convex/server";
import { v } from "convex/values";
export const quickLinkTables = {
  quickLinks: defineTable({
    workspaceId: v.id("workspaces"),
    ownerId: v.id("users"),
    title: v.union(v.string(), v.null()),
    url: v.string(),
    // Legacy JSONField is intentionally open-shaped; validation rejects non-JSON Convex values.
    metadata: v.any(),
    updatedAt: v.number(),
    deletedAt: v.union(v.number(), v.null()),
  })
    .index("by_owner", ["workspaceId", "ownerId", "deletedAt"])
    .index("by_owner_url", ["workspaceId", "ownerId", "deletedAt", "url"]),
};
