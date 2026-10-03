import { defineTable } from "convex/server";
import { v } from "convex/values";
import { contextFields, citation } from "../assistant/schema";
export const generationError = v.union(v.literal("provider_unconfigured"), v.literal("generation_failed"));
export const automationInput = v.record(v.string(), v.string());
export const artifactFields = {
  name: v.string(),
  contentType: v.string(),
  format: v.union(v.literal("pdf"), v.literal("docx"), v.literal("xlsx"), v.literal("pptx")),
};
export const renderedArtifact = v.object({ ...artifactFields, storageId: v.id("_storage") });
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
    sourceConversationId: v.optional(v.id("assistantConversations")),
    sourceAttachmentIds: v.optional(v.array(v.id("assistantAttachments"))),
    template: v.object(templateFields),
    input: automationInput,
    context: v.object(contextFields),
    citations: v.array(citation),
    contextTruncated: v.boolean(),
    status: v.union(v.literal("running"), v.literal("completed"), v.literal("failed")),
    previewMarkdown: v.string(),
    provider: v.string(),
    model: v.string(),
    error: v.union(generationError, v.null()),
    completedAt: v.union(v.number(), v.null()),
    publishedDocumentId: v.union(v.id("documents"), v.null()),
    publishedAt: v.union(v.number(), v.null()),
    artifacts: v.optional(v.array(v.object({ assetId: v.id("assets"), format: artifactFields.format }))),
  })
    .index("by_request", ["requesterId", "requestId"])
    .index("by_workspace_requester", ["workspaceId", "requesterId"]),
};
