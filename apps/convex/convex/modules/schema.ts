import { taskPreferences } from "../tasks/schema";
import { apiIdSchema } from "../identity/schema";
import { zodToConvex } from "convex-helpers/server/zod4";
import { defineTable } from "convex/server";
import { v } from "convex/values";
import type { Infer } from "convex/values";
export const moduleStatus = v.union(
  v.literal("backlog"),
  v.literal("planned"),
  v.literal("in-progress"),
  v.literal("paused"),
  v.literal("completed"),
  v.literal("cancelled")
);
export const moduleFields = {
  name: v.string(),
  descriptionHtml: v.string(),
  startDate: v.union(v.string(), v.null()),
  targetDate: v.union(v.string(), v.null()),
  status: moduleStatus,
  leadId: v.union(v.id("users"), v.null()),
};
export const moduleInput = v.object(moduleFields);
export const moduleChanges = v.object({
  name: v.optional(moduleFields.name),
  descriptionHtml: v.optional(moduleFields.descriptionHtml),
  startDate: v.optional(moduleFields.startDate),
  targetDate: v.optional(moduleFields.targetDate),
  status: v.optional(moduleFields.status),
  leadId: v.optional(moduleFields.leadId),
});
export const moduleDirectoryView = v.union(v.literal("active"), v.literal("archived"), v.literal("trash"));
export const moduleDirectoryOrder = v.union(v.literal("created_at"), v.literal("name"), v.literal("target_date"));
export const moduleDirectoryFilters = v.object({
  search: v.string(),
  favorites: v.boolean(),
  statuses: v.array(moduleStatus),
  leadIds: v.array(v.id("users")),
  memberIds: v.array(v.id("users")),
  startAfter: moduleFields.startDate,
  startBefore: moduleFields.startDate,
  targetAfter: moduleFields.targetDate,
  targetBefore: moduleFields.targetDate,
});
export const defaultModuleFilters: Infer<typeof moduleDirectoryFilters> = {
  search: "",
  favorites: false,
  statuses: [],
  leadIds: [],
  memberIds: [],
  startAfter: null,
  startBefore: null,
  targetAfter: null,
  targetBefore: null,
};
export const moduleTables = {
  moduleUserProperties: defineTable({
    workspaceId: v.id("workspaces"),
    projectId: v.id("projects"),
    moduleId: v.id("modules"),
    userId: v.id("users"),
    taskPreferences,
    revision: v.number(),
  }).index("by_module_user", ["moduleId", "userId"]),
  moduleLinks: defineTable({
    moduleId: v.id("modules"),
    url: v.string(),
    title: v.union(v.string(), v.null()),
    metadata: v.any(),
    deletedAt: v.union(v.number(), v.null()),
    createdBy: v.id("users"),
    updatedBy: v.id("users"),
    updatedAt: v.number(),
  })
    .index("by_module", ["moduleId", "deletedAt"])
    .index("by_module_url", ["moduleId", "url", "deletedAt"]),
  modules: defineTable({
    ...moduleFields,
    apiId: v.optional(zodToConvex(apiIdSchema)),
    description: v.string(),
    descriptionTextJson: v.optional(v.union(v.string(), v.null())),
    viewPropsJson: v.optional(v.string()),
    logoPropsJson: v.optional(v.string()),
    externalSource: v.optional(v.union(v.string(), v.null())),
    externalId: v.optional(v.union(v.string(), v.null())),
    sortOrder: v.optional(v.number()),
    projectId: v.id("projects"),
    workspaceId: v.id("workspaces"),
    createdBy: v.id("users"),
    updatedBy: v.optional(v.union(v.id("users"), v.null())),
    updatedAt: v.number(),
    archived: v.boolean(),
    archivedAt: v.optional(v.union(v.number(), v.null())),
    deleted: v.boolean(),
    deletedAt: v.optional(v.union(v.number(), v.null())),
  })
    .index("by_api_id", ["apiId"])
    .index("by_workspace_created", ["workspaceId", "deleted"])
    .index("by_workspace", ["workspaceId", "deleted", "archived"])
    .index("by_project", ["projectId", "deleted"])
    .index("by_project_order", ["projectId", "deleted", "sortOrder"])
    .index("by_project_due", ["projectId", "deleted", "targetDate"])
    .index("by_project_name", ["projectId", "deleted", "name"]),
  moduleMembers: defineTable({ moduleId: v.id("modules"), userId: v.id("users") }).index("by_module_user", [
    "moduleId",
    "userId",
  ]),
  moduleTasks: defineTable({ moduleId: v.id("modules"), taskId: v.id("tasks") })
    .index("by_module_task", ["moduleId", "taskId"])
    .index("by_task", ["taskId"]),
};
