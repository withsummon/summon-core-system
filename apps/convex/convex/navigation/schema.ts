import { defineTable } from "convex/server";
import { v } from "convex/values";
export const visitTarget = v.union(
  v.object({ type: v.literal("issue"), id: v.id("tasks") }),
  v.object({ type: v.literal("page"), id: v.id("documents") }),
  v.object({ type: v.literal("project"), id: v.id("projects") })
);
export const preferenceKey = v.union(
  v.literal("views"),
  v.literal("active_cycles"),
  v.literal("analytics"),
  v.literal("drafts"),
  v.literal("your_work"),
  v.literal("archives"),
  v.literal("stickies")
);
export const navigationTables = {
  recentVisits: defineTable({
    workspaceId: v.id("workspaces"),
    userId: v.id("users"),
    target: visitTarget,
    targetKey: v.string(),
    visitedAt: v.number(),
  })
    .index("by_owner", ["workspaceId", "userId"])
    .index("by_target", ["workspaceId", "userId", "targetKey"]),
  sidebarPreferences: defineTable({
    workspaceId: v.id("workspaces"),
    userId: v.id("users"),
    key: preferenceKey,
    isPinned: v.boolean(),
    sortOrder: v.number(),
    revision: v.number(),
  })
    .index("by_owner", ["workspaceId", "userId"])
    .index("by_key", ["workspaceId", "userId", "key"]),
};
