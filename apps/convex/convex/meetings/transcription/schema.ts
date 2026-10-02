import { defineTable } from "convex/server";
import { v } from "convex/values";
import { sourceArgs, versionFields } from "../summary/schema";

export const TRANSCRIPTION_UPLOAD_TIMEOUT_MS = 300000;
export const TRANSCRIPTION_WATCHDOG_DELAY_MS = TRANSCRIPTION_UPLOAD_TIMEOUT_MS + 60000;
export const transcriptionError = v.union(
  v.literal("provider_unconfigured"),
  v.literal("transcription_failed"),
  v.literal("invalid_transcript"),
  v.literal("transcription_timeout"),
  v.literal("recording_or_access_changed"),
  v.literal("cancelled"),
  v.literal("recording_removed"),
  v.literal("meeting_removed")
);
export const transcriptionStatus = v.union(
  v.literal("queued"),
  v.literal("running"),
  v.literal("completed"),
  v.literal("failed"),
  v.literal("cancelled")
);
export const startFields = { ...sourceArgs, ...versionFields, recordingAssetId: v.id("assets"), requestId: v.string() };
export const transcriptionTables = {
  meetingTranscriptionRuns: defineTable({
    input: v.object(startFields),
    requesterId: v.id("users"),
    expectedMeetingUpdatedAt: v.number(),
    status: transcriptionStatus,
    attempt: v.number(),
    deadline: v.number(),
    error: v.union(transcriptionError, v.null()),
    documentId: v.union(v.id("documents"), v.null()),
  })
    .index("by_request", ["requesterId", "input.requestId"])
    .index("by_meeting", ["input.meetingId"]),
};
