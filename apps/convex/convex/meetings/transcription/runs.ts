import type { Infer } from "convex/values";
import { compareValues, ConvexError, v } from "convex/values";
import { mutation, query, internalMutation, internalQuery } from "../../_generated/server";
import type { MutationCtx, QueryCtx } from "../../_generated/server";
import type { Doc } from "../../_generated/dataModel";
import { internal } from "../../_generated/api";
import { requireUser } from "../../identity/access";
import { requireAccountUser } from "../../identity/session";
import { requireMeeting } from "../access";
import { requireReadyRecording } from "../../assets/meetingRecordings";
import { sourceArgs, requireTranscriptVersion, prepareTranscript, commitTranscript } from "../summary/transcripts";
import { snapshotFields } from "../../documents/schema";

import { transcriptionError, startFields, TRANSCRIPTION_WATCHDOG_DELAY_MS } from "./schema";
const jobArgs = { runId: v.id("meetingTranscriptionRuns"), attempt: v.number() };
const active = (run: Doc<"meetingTranscriptionRuns">) => run.status === "queued" || run.status === "running";

async function recordingAccess(ctx: QueryCtx, run: Doc<"meetingTranscriptionRuns">) {
  const user = await requireAccountUser(ctx, run.requesterId);
  const { meeting } = await requireTranscriptVersion(
    ctx,
    { ...run.input, expectedMeetingUpdatedAt: run.expectedMeetingUpdatedAt },
    user
  );
  if (meeting.recordingAssetId !== run.input.recordingAssetId) throw new ConvexError("The meeting recording changed.");
  const asset = await requireReadyRecording(ctx, meeting, run.input.recordingAssetId);
  return { user, asset };
}
async function finish(
  ctx: MutationCtx,
  run: Doc<"meetingTranscriptionRuns">,
  status: "failed" | "cancelled",
  error: Infer<typeof transcriptionError>
) {
  await ctx.db.patch(run._id, { status, error });
  await ctx.scheduler.runAfter(0, internal.meetings.transcription.provider.cancel, { runId: run._id });
}

export const start = mutation({
  args: startFields,
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    if (!/^[a-zA-Z0-9_-]{8,100}$/.test(args.requestId)) throw new ConvexError("Invalid request identifier.");
    const previous = await ctx.db
      .query("meetingTranscriptionRuns")
      .withIndex("by_request", (q) => q.eq("requesterId", user._id).eq("input.requestId", args.requestId))
      .unique();
    if (previous) {
      await requireMeeting(ctx, args.workspaceId, args.meetingId, true);
      if (compareValues(previous.input, args) !== 0)
        throw new ConvexError("Request identifier was used for different recording inputs.");
      return previous._id;
    }
    const { meeting } = await requireTranscriptVersion(ctx, args, user);
    await requireReadyRecording(ctx, meeting, args.recordingAssetId);
    const latest = await ctx.db
      .query("meetingTranscriptionRuns")
      .withIndex("by_meeting", (q) => q.eq("input.meetingId", meeting._id))
      .order("desc")
      .first();
    if (latest && active(latest))
      throw new ConvexError("Cancel the current transcription before replacing the recording.");
    if (meeting.recordingAssetId && meeting.recordingAssetId !== args.recordingAssetId)
      await ctx.db.patch(meeting.recordingAssetId, { status: "deleted", expiresAt: Date.now() + 7 * 86400000 });
    const updatedAt = Math.max(Date.now(), meeting.updatedAt + 1);
    await ctx.db.patch(meeting._id, { recordingAssetId: args.recordingAssetId, updatedAt, updatedBy: user._id });
    const runId = await ctx.db.insert("meetingTranscriptionRuns", {
      input: args,
      expectedMeetingUpdatedAt: updatedAt,
      requesterId: user._id,
      status: "queued",
      attempt: 0,
      deadline: Date.now() + 2 * 60 * 60 * 1000,
      error: null,
      documentId: null,
    });
    await ctx.scheduler.runAfter(0, internal.meetings.transcription.runs.tick, { runId, attempt: 0 });
    return runId;
  },
});

export const tick = internalMutation({
  args: jobArgs,
  handler: async (ctx, { runId, attempt }) => {
    const run = await ctx.db.get(runId);
    if (!run || !active(run) || run.attempt !== attempt) return;
    if (run.deadline <= Date.now()) return finish(ctx, run, "failed", "transcription_timeout");
    try {
      await recordingAccess(ctx, run);
    } catch (error) {
      if (!(error instanceof ConvexError)) throw error;
      return finish(ctx, run, "failed", "recording_or_access_changed");
    }
    const nextAttempt = attempt + 1;
    await ctx.db.patch(runId, { status: "running", attempt: nextAttempt });
    // Commit the next watchdog before network I/O. Lost action delivery or response can retry the same provider job.
    await ctx.scheduler.runAfter(TRANSCRIPTION_WATCHDOG_DELAY_MS, internal.meetings.transcription.runs.tick, {
      runId,
      attempt: nextAttempt,
    });
    await ctx.scheduler.runAfter(0, internal.meetings.transcription.provider.step, { runId, attempt: nextAttempt });
  },
});

// Successful provider responses can poll promptly; the committed watchdog remains for lost actions.
export const poll = internalMutation({
  args: jobArgs,
  handler: async (ctx, args) => {
    const run = await ctx.db.get(args.runId);
    if (run && active(run) && run.attempt === args.attempt)
      await ctx.scheduler.runAfter(5000, internal.meetings.transcription.runs.tick, args);
  },
});
export const prepare = internalQuery({
  args: jobArgs,
  handler: async (ctx, { runId, attempt }) => {
    const run = await ctx.db.get(runId);
    if (!run || !active(run) || run.attempt !== attempt || run.deadline <= Date.now()) return null;
    const { user, asset } = await recordingAccess(ctx, run);
    const document = await prepareTranscript(
      ctx,
      { ...run.input, expectedMeetingUpdatedAt: run.expectedMeetingUpdatedAt },
      user
    );
    return { asset, document };
  },
});
export const complete = internalMutation({
  args: { ...jobArgs, transcript: v.string(), language: v.string(), ...snapshotFields },
  handler: async (ctx, { runId, attempt, ...result }) => {
    const run = await ctx.db.get(runId);
    if (!run || !active(run) || run.attempt !== attempt || run.deadline <= Date.now()) return;
    const { user } = await recordingAccess(ctx, run);
    const documentId = await commitTranscript(
      ctx,
      { ...run.input, expectedMeetingUpdatedAt: run.expectedMeetingUpdatedAt, ...result },
      user
    );
    await ctx.db.patch(runId, { status: "completed", documentId, error: null });
    await ctx.scheduler.runAfter(0, internal.meetings.transcription.provider.cancel, { runId });
  },
});
export const fail = internalMutation({
  args: {
    ...jobArgs,
    error: v.union(
      v.literal("provider_unconfigured"),
      v.literal("transcription_failed"),
      v.literal("invalid_transcript")
    ),
  },
  handler: async (ctx, { runId, attempt, error }) => {
    const run = await ctx.db.get(runId);
    if (run && active(run) && run.attempt === attempt) await finish(ctx, run, "failed", error);
  },
});
export const latest = query({
  args: sourceArgs,
  handler: async (ctx, args) => {
    const { user } = await requireMeeting(ctx, args.workspaceId, args.meetingId);
    const run = await ctx.db
      .query("meetingTranscriptionRuns")
      .withIndex("by_meeting", (q) => q.eq("input.meetingId", args.meetingId))
      .order("desc")
      .first();
    return run?.requesterId === user._id ? run : null;
  },
});
export const cancel = mutation({
  args: { runId: v.id("meetingTranscriptionRuns") },
  handler: async (ctx, { runId }) => {
    const user = await requireUser(ctx);
    const run = await ctx.db.get(runId);
    if (!run || run.requesterId !== user._id) throw new ConvexError("Transcription not found.");
    await requireMeeting(ctx, run.input.workspaceId, run.input.meetingId, true);
    if (active(run)) await finish(ctx, run, "cancelled", "cancelled");
  },
});

export const removeRecording = mutation({
  args: { ...sourceArgs, expectedMeetingUpdatedAt: v.number() },
  handler: async (ctx, args) => {
    const { user, meeting } = await requireMeeting(ctx, args.workspaceId, args.meetingId, true);
    if (meeting.updatedAt !== args.expectedMeetingUpdatedAt)
      throw new ConvexError("Meeting changed. Reload before removing its recording.");
    const run = await ctx.db
      .query("meetingTranscriptionRuns")
      .withIndex("by_meeting", (q) => q.eq("input.meetingId", meeting._id))
      .order("desc")
      .first();
    if (run && active(run)) await finish(ctx, run, "cancelled", "recording_removed");
    if (meeting.recordingAssetId) {
      await ctx.db.patch(meeting.recordingAssetId, { status: "deleted", expiresAt: Date.now() + 7 * 86400000 });
      await ctx.db.patch(meeting._id, {
        recordingAssetId: undefined,
        updatedAt: Math.max(Date.now(), meeting.updatedAt + 1),
        updatedBy: user._id,
      });
    }
  },
});
