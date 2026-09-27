import { ConvexError, v } from "convex/values";
import { query, mutation, internalMutation } from "../../_generated/server";
import type { Id } from "../../_generated/dataModel";
import { requireUser } from "../../identity/access";
import { contextFields } from "../../assistant/schema";
import { authorizedContext } from "../../assistant/context";
import { snapshotFields } from "../../documents/schema";
import { summaryAccess } from "./access";
import { sourceArgs } from "./transcripts";
import { resultFields } from "./schema";
import { meetingDocumentTitle } from "./title";
import { writeCanonicalDocument } from "./document";
export const runArgs = {
  ...sourceArgs,
  requestId: v.string(),
  expectedMeetingUpdatedAt: v.number(),
  expectedTranscriptRevision: v.number(),
  expectedDocumentRevision: v.number(),
  expectedDocumentUpdatedAt: v.number(),
  context: v.object(contextFields),
};
export const begin = internalMutation({
  args: runArgs,
  handler: async (ctx, args) => {
    const { meeting, source, document, user } = await summaryAccess(ctx, args.workspaceId, args.meetingId, true);
    if (!source || !document || !meeting.projectId)
      throw new ConvexError("Supply an accessible text transcript before summarizing.");
    if (!/^[a-zA-Z0-9_-]{8,100}$/.test(args.requestId)) throw new ConvexError("Invalid request identifier.");
    if (args.context.projectId && args.context.projectId !== meeting.projectId)
      throw new ConvexError("Context project must match the meeting project.");
    const selection = { ...args.context, projectId: meeting.projectId };
    const context = await authorizedContext(ctx, args.workspaceId, selection);
    const previous = await ctx.db
      .query("meetingSummaryRuns")
      .withIndex("by_request", (q) => q.eq("requesterId", user._id).eq("requestId", args.requestId))
      .unique();
    if (previous) {
      if (
        previous.meetingId !== meeting._id ||
        previous.transcriptRevision !== args.expectedTranscriptRevision ||
        JSON.stringify(previous.context) !== JSON.stringify(selection)
      )
        throw new ConvexError("Request identifier was used for different summary inputs.");
      return { runId: previous._id, generate: false, prompt: "", metadata: null, binary: null };
    }
    if (
      meeting.updatedAt !== args.expectedMeetingUpdatedAt ||
      source.revision !== args.expectedTranscriptRevision ||
      document.revision !== args.expectedDocumentRevision ||
      document.updatedAt !== args.expectedDocumentUpdatedAt
    )
      throw new ConvexError("Meeting or transcript changed. Reload before summarizing.");
    const existing = await ctx.db
      .query("meetingSummaryRuns")
      .withIndex("by_meeting", (q) => q.eq("meetingId", meeting._id))
      .order("desc")
      .first();
    if (existing?.status === "running") throw new ConvexError("A summary is already running for this meeting.");
    const snapshot = await ctx.db
      .query("documentRevisions")
      .withIndex("by_document_revision", (q) => q.eq("documentId", document._id).eq("revision", document.revision))
      .unique();
    if (!snapshot) throw new ConvexError("Canonical document snapshot is unavailable.");
    const prompt = `[Transcript]\n${source.source}\n\n${context.text}`;
    const runId = await ctx.db.insert("meetingSummaryRuns", {
      meetingId: meeting._id,
      requesterId: user._id,
      requestId: args.requestId,
      meetingUpdatedAt: meeting.updatedAt,
      transcriptRevision: source.revision,
      documentRevision: document.revision,
      documentUpdatedAt: document.updatedAt,
      context: selection,
      citations: context.citations,
      contextTruncated: context.truncated || prompt.length > 30000,
      status: "running",
      error: null,
      provider: "",
      model: "",
      result: null,
      documentId: document._id,
    });
    const project = await ctx.db.get(meeting.projectId);
    const profile = await ctx.db
      .query("projectProfiles")
      .withIndex("by_project", (q) => q.eq("projectId", meeting.projectId!))
      .unique();
    const client = profile?.clientId ? await ctx.db.get(profile.clientId) : null;
    const participants = await ctx.db
      .query("meetingParticipants")
      .withIndex("by_meeting_user", (q) => q.eq("meetingId", meeting._id))
      .collect();
    const names = await Promise.all(
      participants.map(async (p) => {
        const participant = await ctx.db.get(p.userId);
        return participant?.name ?? participant?.email ?? "";
      })
    );
    return {
      runId,
      generate: true,
      binary: snapshot.descriptionBinary,
      prompt: prompt.slice(0, 30000),
      metadata: {
        title: meeting.title,
        project: project?.name ?? "",
        startsAt: meeting.startsAt,
        endsAt: meeting.endsAt,
        location: meeting.location,
        participants: names.filter(Boolean),
        client:
          client && !profile?.deleted && !client.deleted && client.workspaceId === meeting.workspaceId
            ? client.name
            : "",
      },
    };
  },
});
export const complete = internalMutation({
  args: {
    runId: v.id("meetingSummaryRuns"),
    result: v.object(resultFields),
    markdown: v.string(),
    provider: v.string(),
    model: v.string(),
    ...snapshotFields,
  },
  handler: async (ctx, args): Promise<Id<"documents">> => {
    const run = await ctx.db.get(args.runId);
    const user = await requireUser(ctx);
    if (!run || run.requesterId !== user._id) throw new ConvexError("Summary run not found.");
    const meeting = await ctx.db.get(run.meetingId);
    if (!meeting) throw new ConvexError("Meeting not found.");
    const access = await summaryAccess(ctx, meeting.workspaceId, meeting._id, true);
    await authorizedContext(ctx, meeting.workspaceId, run.context);
    if (run.status === "completed") return run.documentId;
    if (run.status !== "running" || !access.source || !access.document)
      throw new ConvexError("Summary is no longer running.");
    if (
      access.meeting.updatedAt !== run.meetingUpdatedAt ||
      access.source.revision !== run.transcriptRevision ||
      access.document._id !== run.documentId ||
      access.document.revision !== run.documentRevision ||
      access.document.updatedAt !== run.documentUpdatedAt
    )
      throw new ConvexError("Meeting or document changed during generation. Generate again from its latest version.");
    const documentId = await writeCanonicalDocument(
      ctx,
      meeting,
      access.document,
      meetingDocumentTitle(meeting.title, "MoM"),
      {
        summon_summary_meeting_id: meeting._id,
        summon_document: {
          kind: "summon_mom",
          markdown: args.markdown,
          source_transcript: access.source.source,
          transcription_language: access.source.language,
          ...args.result,
          citations: run.citations,
          context_truncated: run.contextTruncated,
          provider: args.provider,
          model: args.model,
        },
      },
      args
    );
    await ctx.db.patch(run._id, {
      status: "completed",
      result: args.result,
      provider: args.provider,
      model: args.model,
    });
    await ctx.db.patch(meeting._id, {
      summaryDocumentId: documentId,
      updatedAt: Math.max(Date.now(), meeting.updatedAt + 1),
      updatedBy: user._id,
    });
    return documentId;
  },
});
export const fail = internalMutation({
  args: {
    runId: v.id("meetingSummaryRuns"),
    error: v.union(v.literal("provider_unconfigured"), v.literal("generation_failed")),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const run = await ctx.db.get(args.runId);
    if (!run || run.requesterId !== user._id) throw new ConvexError("Summary run not found.");
    if (run.status === "running") await ctx.db.patch(run._id, { status: "failed", error: args.error });
  },
});
export const latest = query({
  args: sourceArgs,
  handler: async (ctx, args) => {
    const { user } = await summaryAccess(ctx, args.workspaceId, args.meetingId);
    const run = await ctx.db
      .query("meetingSummaryRuns")
      .withIndex("by_meeting", (q) => q.eq("meetingId", args.meetingId))
      .order("desc")
      .first();
    if (!run || run.requesterId !== user._id) return null;
    await authorizedContext(ctx, args.workspaceId, run.context);
    return run;
  },
});

export const cancel = mutation({
  args: { runId: v.id("meetingSummaryRuns") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const run = await ctx.db.get(args.runId);
    if (!run || run.requesterId !== user._id) throw new ConvexError("Summary run not found.");
    const meeting = await ctx.db.get(run.meetingId);
    if (!meeting) throw new ConvexError("Meeting not found.");
    await summaryAccess(ctx, meeting.workspaceId, meeting._id, true);
    if (run.status === "running") await ctx.db.patch(run._id, { status: "failed", error: "cancelled" });
  },
});
