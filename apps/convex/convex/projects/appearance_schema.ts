import { defineTable } from "convex/server";
import { v } from "convex/values";
export const projectAppearanceTables = {
  projectAppearance: defineTable({
    projectId: v.id("projects"),
    coverAssetId: v.union(v.id("assets"), v.null()),
    externalCoverUrl: v.optional(v.string()),
    revision: v.number(),
  }).index("by_project", ["projectId"]),
};
