import { defineTable } from "convex/server";
import { v } from "convex/values";
import { zodToConvex } from "convex-helpers/server/zod4";
import { z } from "zod/v4";
import { contentVersion } from "../description_content";
import { draftFields } from "./fields";
export const copyRequestId = z.uuid();
export const taskCopyFields = {
  taskId: v.id("tasks"),
  expectedUpdatedAt: v.number(),
  expectedContentVersion: contentVersion,
  requestId: zodToConvex(copyRequestId),
};
export const copySource = v.object({ ...taskCopyFields, projectId: v.id("projects") });
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
    copySource: v.optional(copySource),
  })
    .index("by_author_workspace", ["authorId", "workspaceId"])
    .index("by_author_copy_request", ["authorId", "copySource.requestId"])
    .index("by_project", ["projectId"])
    .index("by_parent", ["parent.taskId"])
    .index("by_project_state_unpublished", ["projectId", "properties.stateId", "publishedTaskId"]),
};
