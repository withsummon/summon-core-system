import { defineTable } from "convex/server";
import { v } from "convex/values";
import type { Infer } from "convex/values";
import { selectionFields } from "./selection";
export const emailPreferenceSettings = v.object({
  propertyChange: v.boolean(),
  stateChange: v.boolean(),
  comment: v.boolean(),
  mention: v.boolean(),
  issueCompleted: v.boolean(),
});
export const defaultEmailPreferenceSettings: Infer<typeof emailPreferenceSettings> = {
  propertyChange: true,
  stateChange: true,
  comment: true,
  mention: true,
  issueCompleted: true,
};
export const notificationTables = {
  notificationPreferences: defineTable({
    userId: v.id("users"),
    revision: v.number(),
    settings: emailPreferenceSettings,
  }).index("by_user", ["userId"]),
  notificationReadBatches: defineTable({
    workspaceId: v.id("workspaces"),
    receiverId: v.id("users"),
    ...selectionFields,
    cutoff: v.number(),
    now: v.number(),
    completed: v.boolean(),
    cursor: v.union(v.string(), v.null()),
  }).index("by_now", ["now"]),
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
