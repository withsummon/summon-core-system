import { defineTable } from "convex/server";
import { v } from "convex/values";
export const favoriteTarget = v.union(
  v.object({ type: v.literal("project"), id: v.id("projects") }),
  v.object({ type: v.literal("cycle"), id: v.id("cycles") }),
  v.object({ type: v.literal("module"), id: v.id("modules") }),
  v.object({ type: v.literal("view"), id: v.id("savedViews") }),
  v.object({ type: v.literal("page"), id: v.id("documents") }),
  v.object({ type: v.literal("issue"), id: v.id("tasks") }),
  v.object({ type: v.literal("folder") })
);
export const favoriteTables = {
  favorites: defineTable({
    workspaceId: v.id("workspaces"),
    userId: v.id("users"),
    target: favoriteTarget,
    targetType: v.union(
      v.literal("project"),
      v.literal("cycle"),
      v.literal("module"),
      v.literal("view"),
      v.literal("page"),
      v.literal("issue"),
      v.literal("folder")
    ),
    targetProjectId: v.union(v.id("projects"), v.null()),
    projectRevision: v.optional(v.number()),
    targetKey: v.union(v.string(), v.null()),
    name: v.union(v.string(), v.null()),
    parentId: v.union(v.id("favorites"), v.null()),
    sequence: v.number(),
    height: v.number(),
    favoritedAt: v.number(),
    updatedAt: v.number(),
    deletedAt: v.union(v.number(), v.null()),
    legacySourceId: v.optional(v.id("savedViewFavorites")),
  })
    .index("by_owner_parent_order", ["workspaceId", "userId", "parentId", "sequence"])
    .index("by_parent_height", ["parentId", "height"])
    .index("by_owner_target", ["workspaceId", "userId", "targetKey"])
    .index("by_owner_type_project", ["workspaceId", "userId", "targetType", "targetProjectId", "favoritedAt"])
    .index("by_project_type_deleted", ["workspaceId", "targetProjectId", "targetType", "deletedAt"])
    .index("by_legacy_source", ["legacySourceId"]),
};
