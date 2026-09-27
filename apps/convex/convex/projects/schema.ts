import { defineTable } from "convex/server";
import { v } from "convex/values";
export const projectPersonalTables = {
  projectUserProperties: defineTable({
    workspaceId: v.id("workspaces"),
    projectId: v.id("projects"),
    userId: v.id("users"),
    sortOrder: v.number(),
    revision: v.number(),
  })
    .index("by_project_user", ["projectId", "userId"])
    .index("by_owner_order", ["workspaceId", "userId", "sortOrder"]),
};
