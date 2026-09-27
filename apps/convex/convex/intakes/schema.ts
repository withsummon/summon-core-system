import { defineTable } from "convex/server";
import { v } from "convex/values";
export const intakeStatus = v.union(
  v.literal("pending"),
  v.literal("rejected"),
  v.literal("snoozed"),
  v.literal("accepted"),
  v.literal("duplicate")
);
export const intakeTables = {
  intakes: defineTable({
    projectId: v.id("projects"),
    name: v.string(),
    description: v.string(),
    isDefault: v.boolean(),
    updatedAt: v.number(),
  }).index("by_project", ["projectId"]),
  intakeTasks: defineTable({
    projectId: v.id("projects"),
    intakeId: v.id("intakes"),
    taskId: v.id("tasks"),
    status: intakeStatus,
    snoozedUntil: v.union(v.number(), v.null()),
    duplicateTo: v.union(v.id("tasks"), v.null()),
    source: v.literal("IN_APP"),
    createdBy: v.id("users"),
    updatedAt: v.number(),
    deletedAt: v.union(v.number(), v.null()),
  })
    .index("by_task", ["taskId"])
    .index("by_project_status", ["projectId", "status"])
    .index("by_project", ["projectId"]),
};
