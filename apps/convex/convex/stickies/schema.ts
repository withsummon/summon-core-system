import { defineTable } from "convex/server";
import { v } from "convex/values";
export const stickyInput = {
  name: v.optional(v.union(v.string(), v.null())),
  html: v.optional(v.string()),
  editorJson: v.optional(v.any()),
  editorBinary: v.optional(v.union(v.bytes(), v.null())),
  color: v.optional(v.union(v.string(), v.null())),
  backgroundColor: v.optional(v.union(v.string(), v.null())),
  logoProps: v.optional(v.record(v.string(), v.any())),
};
export const stickyTables = {
  stickies: defineTable({
    workspaceId: v.id("workspaces"),
    ownerId: v.id("users"),
    name: v.union(v.string(), v.null()),
    html: v.string(),
    description: v.string(),
    editorJson: v.any(),
    editorBinary: v.union(v.bytes(), v.null()),
    color: v.union(v.string(), v.null()),
    backgroundColor: v.union(v.string(), v.null()),
    logoProps: v.record(v.string(), v.any()),
    sortOrder: v.number(),
    updatedAt: v.number(),
    deletedAt: v.union(v.number(), v.null()),
  }).index("by_owner_order", ["workspaceId", "ownerId", "deletedAt", "sortOrder"]),
};
