import { defineTable } from "convex/server";
import { v } from "convex/values";
import { status as taskStatus } from "../tasks/schema";
export const contextFields = {
  workspace: v.optional(v.boolean()),
  projectId: v.union(v.id("projects"), v.null()),
  clientId: v.union(v.id("clients"), v.null()),
  meetingId: v.union(v.id("meetings"), v.null()),
  documentIds: v.array(v.id("documents")),
};
export const citation = v.object({
  kind: v.union(
    v.literal("workspace"),
    v.literal("project"),
    v.literal("client"),
    v.literal("meeting"),
    v.literal("document"),
    v.literal("attachment")
  ),
  id: v.string(),
  label: v.string(),
});
export const assistantTables = {
  assistantAttachments: defineTable({
    conversationId: v.id("assistantConversations"),
    assetId: v.id("assets"),
    messageId: v.union(v.id("assistantMessages"), v.null()),
    status: v.union(v.literal("uploading"), v.literal("processing"), v.literal("ready"), v.literal("failed")),
    transcription: v.optional(v.object({ requesterId: v.id("users"), attempt: v.number(), deadline: v.number() })),
    name: v.string(),
    contentType: v.string(),
    size: v.number(),
    text: v.string(),
    truncated: v.boolean(),
    deleted: v.boolean(),
    error: v.union(v.string(), v.null()),
  })
    .index("by_conversation", ["conversationId"])
    .index("by_conversation_deleted", ["conversationId", "deleted"])
    .index("by_pending", ["conversationId", "messageId", "deleted"])
    .index("by_asset", ["assetId"]),
  assistantConversations: defineTable({
    workspaceId: v.id("workspaces"),
    ownerId: v.id("users"),
    title: v.string(),
    context: v.object(contextFields),
    lastActivityAt: v.number(),
    activeMessageId: v.union(v.id("assistantMessages"), v.null()),
    deleted: v.boolean(),
  }).index("by_workspace_owner_activity", ["workspaceId", "ownerId", "deleted", "lastActivityAt"]),
  assistantMessages: defineTable({
    mcpInvocationId: v.optional(v.id("mcpInvocations")),
    workspaceId: v.id("workspaces"),
    conversationId: v.id("assistantConversations"),
    requestId: v.string(),
    role: v.union(v.literal("user"), v.literal("assistant")),
    status: v.union(v.literal("completed"), v.literal("streaming"), v.literal("failed"), v.literal("cancelled")),
    content: v.string(),
    citations: v.array(citation),
    context: v.object(contextFields),
    contextTruncated: v.boolean(),
    provider: v.string(),
    model: v.string(),
    inputTokens: v.union(v.number(), v.null()),
    outputTokens: v.union(v.number(), v.null()),
    error: v.union(v.string(), v.null()),
  })
    .index("by_conversation", ["conversationId"])
    .index("by_request_role", ["conversationId", "requestId", "role"]),
  assistantActions: defineTable(
    v.union(
      v.object({
        workspaceId: v.id("workspaces"),
        conversationId: v.id("assistantConversations"),
        requesterId: v.id("users"),
        operation: v.literal("set_task_status"),
        taskId: v.id("tasks"),
        taskTitle: v.string(),
        previousStatus: taskStatus,
        nextStatus: taskStatus,
        expectedUpdatedAt: v.number(),
        status: v.union(v.literal("pending"), v.literal("completed"), v.literal("cancelled")),
        confirmedAt: v.union(v.number(), v.null()),
      }),
      v.object({
        workspaceId: v.id("workspaces"),
        conversationId: v.id("assistantConversations"),
        requesterId: v.id("users"),
        operation: v.literal("generate_document"),
        request: v.string(),
        templateId: v.union(v.id("automationTemplates"), v.null()),
        templateRevision: v.union(v.number(), v.null()),
        projectId: v.union(v.id("projects"), v.null()),
        attachmentIds: v.array(v.id("assistantAttachments")),
        jobId: v.union(v.id("automationJobs"), v.null()),
        generationAttempt: v.number(),
        status: v.union(
          v.literal("pending"),
          v.literal("running"),
          v.literal("completed"),
          v.literal("failed"),
          v.literal("cancelled")
        ),
        error: v.union(v.literal("document_generation_failed"), v.literal("document_render_failed"), v.null()),
        confirmedAt: v.union(v.number(), v.null()),
      })
    )
  ).index("by_conversation", ["conversationId"]),
};
