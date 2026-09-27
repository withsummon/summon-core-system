import { defineTable } from "convex/server";
import { v } from "convex/values";
export const cycleFields = {
  name: v.string(),
  description: v.string(),
  startDate: v.union(v.string(), v.null()),
  endDate: v.union(v.string(), v.null()),
};
export const cycleTables = {
  cycles: defineTable({
    ...cycleFields,
    workspaceId: v.id("workspaces"),
    projectId: v.id("projects"),
    createdBy: v.id("users"),
    timezone: v.string(),
    updatedAt: v.number(),
    archived: v.boolean(),
    deleted: v.boolean(),
  }).index("by_project", ["projectId", "deleted"]),
  cycleTasks: defineTable({ cycleId: v.id("cycles"), taskId: v.id("tasks") })
    .index("by_task", ["taskId"])
    .index("by_cycle", ["cycleId"]),
};
