import { defineTable } from "convex/server";
import { v } from "convex/values";
export const resourceFields = {
  title: v.string(),
  url: v.string(),
  description: v.string(),
  category: v.string(),
  projectId: v.union(v.id("projects"), v.null()),
  documentId: v.union(v.id("documents"), v.null()),
  clientId: v.union(v.id("clients"), v.null()),
};
export const resourceTables = {
  resources: defineTable({
    ...resourceFields,
    workspaceId: v.id("workspaces"),
    createdBy: v.id("users"),
    updatedBy: v.id("users"),
    updatedAt: v.number(),
    deleted: v.boolean(),
  }).index("by_workspace_updated", ["workspaceId", "deleted", "updatedAt"]),
};
