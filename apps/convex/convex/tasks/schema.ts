import { defineTable } from "convex/server";
import { v } from "convex/values";
export const status = v.union(
  v.literal("backlog"),
  v.literal("todo"),
  v.literal("in_progress"),
  v.literal("done"),
  v.literal("cancelled")
);
export const taskStatus = v.union(status, v.literal("triage"));
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
export const relationKind = v.union(v.literal("blocks"), v.literal("relates_to"), v.literal("duplicate"));
export const taskTables = {
  taskComments: defineTable({
    taskId: v.id("tasks"),
    authorId: v.id("users"),
    html: v.string(),
    text: v.string(),
    updatedAt: v.number(),
    editedAt: v.union(v.number(), v.null()),
    deletedAt: v.optional(v.union(v.number(), v.null())),
  }).index("by_task", ["taskId"]),
  taskDescriptionVersions: defineTable({
    taskId: v.id("tasks"),
    actorId: v.id("users"),
    html: v.string(),
    description: v.string(),
    lastSavedAt: v.number(),
    revision: v.number(),
  }).index("by_task", ["taskId"]),
  taskDescriptions: defineTable({ taskId: v.id("tasks"), html: v.string() }).index("by_task", ["taskId"]),
  taskParents: defineTable({ projectId: v.id("projects"), childId: v.id("tasks"), parentId: v.id("tasks") })
    .index("by_child", ["childId"])
    .index("by_parent", ["parentId"]),
  taskRelations: defineTable({
    projectId: v.id("projects"),
    fromId: v.id("tasks"),
    toId: v.id("tasks"),
    kind: relationKind,
  })
    .index("by_from", ["fromId"])
    .index("by_to", ["toId"])
    .index("by_project", ["projectId"])
    .index("by_pair", ["fromId", "toId"]),
  tasks: defineTable({
    archivedAt: v.optional(v.union(v.number(), v.null())),
    deletedAt: v.optional(v.union(v.number(), v.null())),
    workspaceId: v.id("workspaces"),
    projectId: v.id("projects"),
    title: v.string(),
    description: v.string(),
    status: taskStatus,
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
    commentId: v.optional(v.id("taskComments")),
    kind: v.union(
      v.literal("created"),
      v.literal("status_changed"),
      v.literal("updated"),
      v.literal("comment_created"),
      v.literal("comment_updated"),
      v.literal("comment_deleted"),
      v.literal("comment_restored")
    ),
    status: taskStatus,
  }).index("by_task", ["taskId"]),
  taskStates: defineTable({
    ...stateFields,
    status: taskStatus,
    workspaceId: v.id("workspaces"),
    projectId: v.id("projects"),
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_project_name", ["projectId", "name"])
    .index("by_project_order", ["projectId", "sortOrder"])
    .index("by_project_default", ["projectId", "isDefault"]),
  taskLabels: defineTable({ ...labelFields, workspaceId: v.id("workspaces"), projectId: v.id("projects") })
    .index("by_workspace", ["workspaceId"])
    .index("by_project_name", ["projectId", "name"])
    .index("by_project_order", ["projectId", "sortOrder"]),
};
