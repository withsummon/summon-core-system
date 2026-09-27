import { defineTable } from "convex/server";
import { v } from "convex/values";
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
export const moduleTables = {
  modules: defineTable({
    ...moduleFields,
    description: v.string(),
    projectId: v.id("projects"),
    workspaceId: v.id("workspaces"),
    createdBy: v.id("users"),
    updatedAt: v.number(),
    archived: v.boolean(),
    deleted: v.boolean(),
  })
    .index("by_project", ["projectId", "deleted"])
    .index("by_project_name", ["projectId", "deleted", "name"]),
  moduleMembers: defineTable({ moduleId: v.id("modules"), userId: v.id("users") }).index("by_module_user", [
    "moduleId",
    "userId",
  ]),
  moduleTasks: defineTable({ moduleId: v.id("modules"), taskId: v.id("tasks") })
    .index("by_module_task", ["moduleId", "taskId"])
    .index("by_task", ["taskId"]),
};
