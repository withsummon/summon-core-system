import { defineTable } from "convex/server";
import { v } from "convex/values";
import { contextFields, citation } from "../../assistant/schema";
export const resultFields = {
  summary: v.string(),
  decisions: v.array(v.string()),
  action_suggestions: v.array(v.object({ title: v.string(), details: v.string() })),
  discussion_topics: v.array(v.object({ topic: v.string(), details: v.array(v.string()) })),
  todos_by_party: v.array(
    v.object({ party: v.string(), items: v.array(v.object({ task: v.string(), notes: v.string() })) })
  ),
  open_items: v.array(v.string()),
  next_actions: v.array(v.object({ action: v.string(), owner: v.string(), due_date: v.string() })),
};
export const summaryTables = {
  meetingTranscripts: defineTable({
    meetingId: v.id("meetings"),
    documentId: v.id("documents"),
    source: v.string(),
    language: v.string(),
    revision: v.number(),
    updatedBy: v.id("users"),
  }).index("by_meeting", ["meetingId"]),
  meetingSummaryRuns: defineTable({
    meetingId: v.id("meetings"),
    requesterId: v.id("users"),
    requestId: v.string(),
    meetingUpdatedAt: v.number(),
    transcriptRevision: v.number(),
    documentRevision: v.number(),
    documentUpdatedAt: v.number(),
    context: v.object(contextFields),
    citations: v.array(citation),
    contextTruncated: v.boolean(),
    status: v.union(v.literal("running"), v.literal("completed"), v.literal("failed")),
    error: v.union(v.string(), v.null()),
    provider: v.string(),
    model: v.string(),
    result: v.union(v.object(resultFields), v.null()),
    documentId: v.id("documents"),
  })
    .index("by_request", ["requesterId", "requestId"])
    .index("by_meeting", ["meetingId"]),
};
