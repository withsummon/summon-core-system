import { defineTable } from "convex/server";
import { v } from "convex/values";
export const status = v.union(
  v.literal("backlog"),
  v.literal("todo"),
  v.literal("in_progress"),
  v.literal("done"),
  v.literal("cancelled")
);
export const priority = v.union(
  v.literal("urgent"),
  v.literal("high"),
  v.literal("medium"),
  v.literal("low"),
  v.literal("none")
);
export const taskProperties = {
  priority,
  assigneeIds: v.array(v.id("users")),
  labelIds: v.array(v.id("taskLabels")),
  startDate: v.union(v.string(), v.null()),
  targetDate: v.union(v.string(), v.null()),
  stateId: v.union(v.id("taskStates"), v.null()),
};
export const stateFields = {
  name: v.string(),
  description: v.string(),
  color: v.string(),
  status,
  sortOrder: v.number(),
  isDefault: v.boolean(),
};
export const labelFields = { name: v.string(), description: v.string(), color: v.string(), sortOrder: v.number() };
export const taskTables = {
  tasks: defineTable({
    workspaceId: v.id("workspaces"),
    projectId: v.id("projects"),
    title: v.string(),
    description: v.string(),
    status,
    sequence: v.number(),
    createdBy: v.id("users"),
    updatedAt: v.number(),
    ...taskProperties,
    completedAt: v.union(v.number(), v.null()),
  })
    .index("by_project", ["projectId"])
    .index("by_project_status", ["projectId", "status"])
    .index("by_workspace", ["workspaceId"])
    .index("by_state", ["stateId"]),
  taskEvents: defineTable({
    workspaceId: v.id("workspaces"),
    projectId: v.id("projects"),
    taskId: v.id("tasks"),
    actorId: v.id("users"),
    kind: v.union(v.literal("created"), v.literal("status_changed"), v.literal("updated")),
    status,
  }).index("by_task", ["taskId"]),
  taskStates: defineTable({ ...stateFields, workspaceId: v.id("workspaces"), projectId: v.id("projects") })
    .index("by_project_name", ["projectId", "name"])
    .index("by_project_order", ["projectId", "sortOrder"])
    .index("by_project_default", ["projectId", "isDefault"]),
  taskLabels: defineTable({ ...labelFields, workspaceId: v.id("workspaces"), projectId: v.id("projects") })
    .index("by_project_name", ["projectId", "name"])
    .index("by_project_order", ["projectId", "sortOrder"]),
};
