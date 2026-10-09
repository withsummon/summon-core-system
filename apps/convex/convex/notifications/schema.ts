import { defineTable } from "convex/server";
import { v } from "convex/values";
import type { Infer } from "convex/values";
import { taskChange } from "../tasks/schema";
const category = v.union(v.literal("assigned"), v.literal("subscribed"), v.literal("created"));
export const selectionFields = {
  view: v.union(v.literal("inbox"), v.literal("archived"), v.literal("snoozed")),
  mentionsOnly: v.optional(v.boolean()),
  categories: v.optional(v.array(category)),
};
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
  notificationEventDeliveries: defineTable({
    eventId: v.id("taskEvents"),
    subscribers: v.array(v.id("users")),
    mentions: v.array(v.id("users")),
    commentBefore: v.union(v.string(), v.null()),
    commentAfter: v.union(v.string(), v.null()),
    cursor: v.union(v.string(), v.null()),
    completed: v.boolean(),
  }),
  notificationEmailBatches: defineTable({
    taskId: v.id("tasks"),
    receiverId: v.id("users"),
    processedAt: v.union(v.number(), v.null()),
    providerId: v.union(v.string(), v.null()),
    acceptedAt: v.union(v.number(), v.null()),
    failure: v.union(v.null(), v.literal("unavailable"), v.literal("too_large"), v.literal("unconfirmed")),
  })
    .index("by_receiver_task_processed", ["receiverId", "taskId", "processedAt"])
    .index("by_processed", ["processedAt"])
    .index("by_accepted", ["acceptedAt"]),
  notificationEmailLogs: defineTable({
    batchId: v.id("notificationEmailBatches"),
    deliveryId: v.id("notificationEventDeliveries"),
    fields: v.array(v.union(...taskChange.members.map((member) => member.fields.field))),
    mention: v.boolean(),
    comment: v.boolean(),
  })
    .index("by_batch", ["batchId"])
    .index("by_delivery", ["deliveryId"]),
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
