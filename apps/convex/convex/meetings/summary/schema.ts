import { defineTable } from "convex/server";
import { v } from "convex/values";
import { z } from "zod/v4";
import { zodToConvexFields } from "convex-helpers/server/zod4";
import { contextFields, citation } from "../../assistant/schema";
export const sourceArgs = { workspaceId: v.id("workspaces"), meetingId: v.id("meetings") };
export const versionFields = {
  expectedMeetingUpdatedAt: v.number(),
  expectedTranscriptRevision: v.union(v.number(), v.null()),
  expectedDocumentRevision: v.union(v.number(), v.null()),
  expectedDocumentUpdatedAt: v.union(v.number(), v.null()),
};
const text = z.string().trim();
const requiredText = text.min(1);
export const resultSchema = z.strictObject({
  summary: requiredText,
  decisions: z.array(requiredText).max(200),
  action_suggestions: z.array(z.strictObject({ title: requiredText, details: text })).max(200),
  discussion_topics: z.array(z.strictObject({ topic: requiredText, details: z.array(requiredText).max(200) })).max(200),
  todos_by_party: z
    .array(
      z.strictObject({
        party: requiredText,
        items: z.array(z.strictObject({ task: requiredText, notes: text })).max(200),
      })
    )
    .max(200),
  open_items: z.array(requiredText).max(200),
  next_actions: z.array(z.strictObject({ action: requiredText, owner: text, due_date: text })).max(200),
});
export const resultFields = zodToConvexFields(resultSchema.shape);
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
    .index("by_meeting", ["meetingId"])
    .index("by_meeting_status_requester", ["meetingId", "status", "requesterId"]),
};
