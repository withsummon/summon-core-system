import { taskPreferences } from "../tasks/schema";
import { defineTable } from "convex/server";
import { v } from "convex/values";
const totals = { count: v.number(), numericEstimates: v.number(), unquantifiedEstimates: v.number() };
const snapshot = v.object({
  ...totals,
  captureStartedAt: v.number(),
  captureCompletedAt: v.union(v.number(), v.null()),
  startDate: v.union(v.string(), v.null()),
  endDate: v.union(v.string(), v.null()),
  timezone: v.string(),
  asOfDay: v.string(),
});
export const cycleFields = {
  name: v.string(),
  description: v.string(),
  startDate: v.union(v.string(), v.null()),
  endDate: v.union(v.string(), v.null()),
};
export const cycleTables = {
  cycleUserProperties: defineTable({
    workspaceId: v.id("workspaces"),
    projectId: v.id("projects"),
    cycleId: v.id("cycles"),
    userId: v.id("users"),
    taskPreferences,
    revision: v.number(),
  }).index("by_cycle_user", ["cycleId", "userId"]),
  cycleTransfers: defineTable({
    projectId: v.id("projects"),
    sourceId: v.id("cycles"),
    destinationId: v.id("cycles"),
    actorId: v.id("users"),
    snapshot,
    phase: v.union(v.literal("capturing"), v.literal("moving")),
    captureCursor: v.union(v.string(), v.null()),
    sourceUpdatedAt: v.number(),
    capturedMemberships: v.number(),
    pendingCount: v.number(),
    movedCount: v.number(),
    skippedCount: v.number(),
    status: v.union(v.literal("running"), v.literal("completed"), v.literal("cancelled")),
    revision: v.number(),
  })
    .index("by_source", ["sourceId"])
    .index("by_source_status", ["sourceId", "status"]),
  cycleTransferEntries: defineTable({
    transferId: v.id("cycleTransfers"),
    taskId: v.id("tasks"),
    membershipId: v.id("cycleTasks"),
    expectedUpdatedAt: v.number(),
    outcome: v.union(v.literal("pending"), v.literal("moved"), v.literal("skipped")),
    skipReason: v.union(v.string(), v.null()),
  })
    .index("by_transfer_task", ["transferId", "taskId"])
    .index("by_transfer_outcome", ["transferId", "outcome"]),
  cycleTransferBuckets: defineTable({
    transferId: v.id("cycleTransfers"),
    kind: v.union(v.literal("statuses"), v.literal("assignees"), v.literal("labels"), v.literal("completion")),
    id: v.union(v.string(), v.null()),
    name: v.string(),
    ...totals,
  })
    .index("by_transfer", ["transferId"])
    .index("by_transfer_kind_id", ["transferId", "kind", "id"]),
  cycles: defineTable({
    ...cycleFields,
    workspaceId: v.id("workspaces"),
    projectId: v.id("projects"),
    createdBy: v.id("users"),
    timezone: v.string(),
    updatedAt: v.number(),
    archived: v.boolean(),
    deleted: v.boolean(),
  })
    .index("by_project", ["projectId", "deleted"])
    .index("by_workspace_created", ["workspaceId", "deleted"])
    .index("by_workspace", ["workspaceId", "deleted", "archived"]),
  cycleTasks: defineTable({ cycleId: v.id("cycles"), taskId: v.id("tasks") })
    .index("by_task", ["taskId"])
    .index("by_cycle", ["cycleId"]),
};
