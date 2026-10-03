import { defineTable } from "convex/server";
import { v } from "convex/values";
const curveTotals = { count: v.number(), points: v.number(), unquantified: v.number() };
const completionCurve = v.object({
  startDate: v.union(v.string(), v.null()),
  endDate: v.union(v.string(), v.null()),
  timezone: v.string(),
  asOfDay: v.string(),
  ...curveTotals,
  completed: v.array(v.object({ day: v.string(), ...curveTotals })),
});
const totals = { count: v.number(), numericEstimates: v.number(), unquantifiedEstimates: v.number() };
const distribution = v.object({ id: v.union(v.string(), v.null()), name: v.string(), ...totals });
const transferSnapshot = v.object({
  ...totals,
  statuses: v.array(distribution),
  assignees: v.array(distribution),
  labels: v.array(distribution),
  capturedAt: v.number(),
  completionCurve: v.optional(completionCurve),
});
export const cycleFields = {
  name: v.string(),
  description: v.string(),
  startDate: v.union(v.string(), v.null()),
  endDate: v.union(v.string(), v.null()),
};
export const cycleTables = {
  cycleTransfers: defineTable({
    projectId: v.id("projects"),
    sourceId: v.id("cycles"),
    destinationId: v.id("cycles"),
    actorId: v.id("users"),
    snapshot: transferSnapshot,
    entries: v.array(
      v.object({
        taskId: v.id("tasks"),
        membershipId: v.id("cycleTasks"),
        expectedUpdatedAt: v.number(),
        outcome: v.union(v.literal("pending"), v.literal("moved"), v.literal("skipped")),
        skipReason: v.union(v.string(), v.null()),
      })
    ),
    status: v.union(v.literal("running"), v.literal("completed"), v.literal("cancelled")),
    revision: v.number(),
  })
    .index("by_source", ["sourceId"])
    .index("by_source_status", ["sourceId", "status"]),
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
    .index("by_workspace", ["workspaceId", "deleted", "archived"]),
  cycleTasks: defineTable({ cycleId: v.id("cycles"), taskId: v.id("tasks") })
    .index("by_task", ["taskId"])
    .index("by_cycle", ["cycleId"]),
};
