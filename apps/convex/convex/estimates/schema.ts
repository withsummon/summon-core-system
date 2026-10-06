import { apiIdSchema } from "../identity/schema";
import { zodToConvex } from "convex-helpers/server/zod4";
import { defineTable } from "convex/server";
import { v } from "convex/values";
export const systemFields = {
  name: v.string(),
  description: v.string(),
  type: v.union(v.literal("points"), v.literal("categories")),
};
export const pointFields = { key: v.number(), value: v.string(), description: v.string() };
export const pointInput = v.object({ ...pointFields, description: v.optional(pointFields.description) });
export const estimateTables = {
  estimateSystems: defineTable({
    apiId: zodToConvex(apiIdSchema),
    ...systemFields,
    projectId: v.id("projects"),
    workspaceId: v.id("workspaces"),
    revision: v.number(),
    deleted: v.boolean(),
    retiring: v.boolean(),
  })
    .index("by_api_id", ["apiId"])
    .index("by_project", ["projectId", "deleted"]),
  estimatePoints: defineTable({
    // Optional only during exact-preimage adoption; allocated UUIDs are immutable.
    apiId: v.optional(zodToConvex(apiIdSchema)),
    // Absent audit fields are unrecorded history, never derived from revision or creation time.
    createdBy: v.optional(v.union(v.id("users"), v.null())),
    updatedBy: v.optional(v.union(v.id("users"), v.null())),
    updatedAt: v.optional(v.number()),
    deletedAt: v.optional(v.union(v.number(), v.null())),
    ...pointFields,
    systemId: v.id("estimateSystems"),
    projectId: v.id("projects"),
    revision: v.number(),
    deleted: v.boolean(),
    retiring: v.boolean(),
  })
    .index("by_api_id", ["apiId"])
    .index("by_system", ["systemId", "deleted"]),
  projectEstimates: defineTable({
    projectId: v.id("projects"),
    activeSystemId: v.union(v.id("estimateSystems"), v.null()),
    lastUsedSystemId: v.union(v.id("estimateSystems"), v.null()),
    revision: v.number(),
    jobId: v.union(v.id("estimateRemaps"), v.null()),
  }).index("by_project", ["projectId"]),
  estimateRemaps: defineTable({
    projectId: v.id("projects"),
    actorId: v.id("users"),
    systemId: v.id("estimateSystems"),
    pointIds: v.array(v.id("estimatePoints")),
    replacementId: v.union(v.id("estimatePoints"), v.null()),
    deleteSystem: v.boolean(),
    phase: v.union(v.literal("tasks"), v.literal("drafts"), v.literal("complete")),
    cursor: v.union(v.string(), v.null()),
    changed: v.number(),
    revision: v.number(),
  }).index("by_project", ["projectId"]),
};
