import { defineTable } from "convex/server";
import { v } from "convex/values";
import { draftFields } from "./fields";
export const draftTables = {
  taskDrafts: defineTable({
    workspaceId: v.id("workspaces"),
    authorId: v.id("users"),
    ...draftFields,
    description: v.string(),
    descriptionJson: v.any(),
    descriptionBinary: v.union(v.bytes(), v.null()),
    updatedAt: v.number(),
    contentRevision: v.number(),
    deletedAt: v.union(v.number(), v.null()),
    publishedTaskId: v.union(v.id("tasks"), v.null()),
  })
    .index("by_author_workspace", ["authorId", "workspaceId"])
    .index("by_project", ["projectId"]),
};
