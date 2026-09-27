import { defineTable } from "convex/server";
import { v } from "convex/values";
import { contextFields, citation } from "../assistant/schema";
export const templateFields = {
  name: v.string(),
  type: v.string(),
  description: v.string(),
  contentTemplate: v.string(),
  variables: v.array(v.string()),
  isActive: v.boolean(),
};
export const automationTables = {
  automationTemplates: defineTable({
    workspaceId: v.id("workspaces"),
    ...templateFields,
    revision: v.number(),
    deleted: v.boolean(),
    systemKey: v.union(v.string(), v.null()),
  })
    .index("by_workspace", ["workspaceId", "deleted"])
    .index("by_name", ["workspaceId", "name", "deleted"])
    .index("by_system_key", ["workspaceId", "systemKey"]),
  automationJobs: defineTable({
    workspaceId: v.id("workspaces"),
    projectId: v.id("projects"),
    requesterId: v.id("users"),
    templateId: v.id("automationTemplates"),
    requestId: v.string(),
    title: v.string(),
    template: v.object(templateFields),
    input: v.record(v.string(), v.any()),
    context: v.object(contextFields),
    citations: v.array(citation),
    contextTruncated: v.boolean(),
    status: v.union(v.literal("running"), v.literal("completed"), v.literal("failed")),
    previewMarkdown: v.string(),
    provider: v.string(),
    model: v.string(),
    error: v.union(v.string(), v.null()),
    completedAt: v.union(v.number(), v.null()),
    publishedDocumentId: v.union(v.id("documents"), v.null()),
    publishedAt: v.union(v.number(), v.null()),
  })
    .index("by_request", ["requesterId", "requestId"])
    .index("by_workspace_requester", ["workspaceId", "requesterId"]),
};
