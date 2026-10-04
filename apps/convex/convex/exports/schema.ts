import { defineTable } from "convex/server";
import { v } from "convex/values";
import { z } from "zod/v4";
import { zodToConvex } from "convex-helpers/server/zod4";

export const exportFormat = v.union(v.literal("csv"), v.literal("xlsx"), v.literal("json"));
export const exportFormatLabels = { csv: "CSV", xlsx: "Excel", json: "JSON" } satisfies Record<
  typeof exportFormat.type,
  string
>;
export const exportFailure = v.union(v.literal("processing_failed"), v.literal("deadline_exceeded"));
export const exportRequestId = z.uuid();
export const exportLifetime = 7 * 24 * 60 * 60 * 1000;
export const exportTables = {
  workspaceExports: defineTable({
    workspaceId: v.id("workspaces"),
    requesterId: v.id("users"),
    requestId: zodToConvex(exportRequestId),
    format: exportFormat,
    requestedProjectIds: v.array(v.id("projects")),
    projectIds: v.array(v.id("projects")),
    sourceProjectIds: v.array(v.id("projects")),
    perProject: v.boolean(),
    status: v.union(
      v.literal("queued"),
      v.literal("processing"),
      v.literal("completed"),
      v.literal("failed"),
      v.literal("expired")
    ),
    failure: v.union(exportFailure, v.null()),
    deadline: v.number(),
    expiresAt: v.number(),
    assetId: v.union(v.id("assets"), v.null()),
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_requester_request", ["requesterId", "requestId"]),
};
