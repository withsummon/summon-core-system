import { transcriptionTables } from "./transcription/schema";
import { summaryTables } from "./summary/schema";
import { defineTable } from "convex/server";
import { v } from "convex/values";
export const meetingStatus = v.union(v.literal("scheduled"), v.literal("completed"), v.literal("cancelled"));
export const participantResponse = v.union(v.literal("pending"), v.literal("accepted"), v.literal("declined"));
export const meetingFields = {
  title: v.string(),
  agenda: v.string(),
  notes: v.string(),
  location: v.string(),
  meetingUrl: v.string(),
  status: meetingStatus,
  startsAt: v.number(),
  endsAt: v.union(v.number(), v.null()),
  projectId: v.union(v.id("projects"), v.null()),
  summaryDocumentId: v.union(v.id("documents"), v.null()),
};
export const meetingTables = {
  ...summaryTables,
  ...transcriptionTables,
  meetings: defineTable({
    ...meetingFields,
    workspaceId: v.id("workspaces"),
    organizerId: v.id("users"),
    recordingAssetId: v.optional(v.id("assets")),
    updatedAt: v.number(),
    updatedBy: v.id("users"),
    deleted: v.boolean(),
  }).index("by_workspace_start", ["workspaceId", "deleted", "startsAt"]),
  meetingParticipants: defineTable({
    workspaceId: v.id("workspaces"),
    meetingId: v.id("meetings"),
    userId: v.id("users"),
    response: participantResponse,
  }).index("by_meeting_user", ["meetingId", "userId"]),
  meetingTasks: defineTable({
    workspaceId: v.id("workspaces"),
    meetingId: v.id("meetings"),
    taskId: v.id("tasks"),
    createdBy: v.id("users"),
  })
    .index("by_meeting_task", ["meetingId", "taskId"])
    .index("by_workspace", ["workspaceId"]),
};
