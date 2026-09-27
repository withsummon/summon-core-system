import { defineTable } from "convex/server";
import { v } from "convex/values";
export const notificationTables = {
  taskSubscriptions: defineTable({ taskId: v.id("tasks"), userId: v.id("users") }).index("by_task_user", [
    "taskId",
    "userId",
  ]),
  notifications: defineTable({
    workspaceId: v.id("workspaces"),
    projectId: v.id("projects"),
    taskId: v.id("tasks"),
    eventId: v.id("taskEvents"),
    receiverId: v.id("users"),
    isMention: v.optional(v.boolean()),
    actorId: v.id("users"),
    readAt: v.union(v.number(), v.null()),
    archivedAt: v.union(v.number(), v.null()),
    snoozedUntil: v.union(v.number(), v.null()),
  }).index("by_receiver_workspace", ["receiverId", "workspaceId"]),
};
