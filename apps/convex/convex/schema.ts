import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

export const role = v.union(v.literal("admin"), v.literal("member"), v.literal("guest"));
export const status = v.union(
  v.literal("backlog"),
  v.literal("todo"),
  v.literal("in_progress"),
  v.literal("done"),
  v.literal("cancelled")
);
export default defineSchema({
  ...authTables,
  workspaces: defineTable({ name: v.string(), slug: v.string() }).index("by_slug", ["slug"]),
  workspaceMembers: defineTable({ workspaceId: v.id("workspaces"), userId: v.id("users"), role, active: v.boolean() })
    .index("by_workspace_user", ["workspaceId", "userId"])
    .index("by_user", ["userId"])
    .index("by_workspace_role_active", ["workspaceId", "role", "active"]),
  projects: defineTable({
    workspaceId: v.id("workspaces"),
    name: v.string(),
    identifier: v.string(),
    nextSequence: v.number(),
    archived: v.boolean(),
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_workspace_identifier", ["workspaceId", "identifier"]),
  projectMembers: defineTable({
    workspaceId: v.id("workspaces"),
    projectId: v.id("projects"),
    userId: v.id("users"),
    role,
    active: v.boolean(),
  })
    .index("by_project_user", ["projectId", "userId"])
    .index("by_workspace_user", ["workspaceId", "userId"])
    .index("by_project_role_active", ["projectId", "role", "active"]),
  tasks: defineTable({
    workspaceId: v.id("workspaces"),
    projectId: v.id("projects"),
    title: v.string(),
    description: v.string(),
    status,
    sequence: v.number(),
    createdBy: v.id("users"),
    updatedAt: v.number(),
  })
    .index("by_project", ["projectId"])
    .index("by_project_status", ["projectId", "status"]),
  taskEvents: defineTable({
    workspaceId: v.id("workspaces"),
    projectId: v.id("projects"),
    taskId: v.id("tasks"),
    actorId: v.id("users"),
    kind: v.union(v.literal("created"), v.literal("status_changed")),
    status,
  }).index("by_task", ["taskId"]),
});
