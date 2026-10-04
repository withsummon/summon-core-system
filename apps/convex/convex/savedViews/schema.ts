import { defineTable } from "convex/server";
import { v } from "convex/values";
import { viewFilters, taskDisplayFilters, taskDisplayProperties } from "../tasks/schema";
export { viewFilters } from "../tasks/schema";
import { projectLogoProps } from "../projects/branding_schema";
export const viewAccess = v.union(v.literal("private"), v.literal("public"));
export const viewListFields = {
  search: v.optional(v.string()),
  orderBy: v.optional(v.union(v.literal("name"), v.literal("created_at"), v.literal("updated_at"))),
  order: v.optional(v.union(v.literal("asc"), v.literal("desc"))),
  ownerIds: v.optional(v.array(v.id("users"))),
  favorites: v.optional(v.boolean()),
  createdAt: v.optional(v.array(v.object({ before: v.boolean(), timestamp: v.number() }))),
};
export const viewDisplayFields = {
  displayFilters: v.optional(taskDisplayFilters),
  displayProperties: v.optional(taskDisplayProperties),
};
export const viewDefinitionFields = {
  name: v.string(),
  description: v.string(),
  filters: viewFilters,
  ...viewDisplayFields,
  access: v.optional(viewAccess),
  logoProps: v.optional(projectLogoProps),
};
export const savedViewTables = {
  savedViews: defineTable({
    workspaceId: v.id("workspaces"),
    projectId: v.union(v.id("projects"), v.null()),
    ownerId: v.id("users"),
    name: v.string(),
    nameFolded: v.optional(v.string()),
    description: v.string(),
    access: viewAccess,
    logoProps: projectLogoProps,
    filters: viewFilters,
    ...viewDisplayFields,
    isLocked: v.boolean(),
    updatedAt: v.number(),
    deletedAt: v.union(v.number(), v.null()),
  })
    .index("by_project_deleted", ["projectId", "deletedAt"])
    .index("by_project_name", ["projectId", "nameFolded"])
    .index("by_project_updated", ["projectId", "updatedAt"])
    .index("by_project_created", ["projectId"])
    .index("by_workspace_project_deleted", ["workspaceId", "projectId", "deletedAt"]),
  savedViewFavorites: defineTable({
    workspaceId: v.id("workspaces"),
    projectId: v.union(v.id("projects"), v.null()),
    viewId: v.id("savedViews"),
    userId: v.id("users"),
  })
    .index("by_view_user", ["viewId", "userId"])
    .index("by_project_user", ["projectId", "userId"])
    .index("by_workspace_project_user", ["workspaceId", "projectId", "userId"]),
};
