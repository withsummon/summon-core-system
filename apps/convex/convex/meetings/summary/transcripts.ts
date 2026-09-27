import { ConvexError, v } from "convex/values";
import { query, internalQuery, internalMutation } from "../../_generated/server";
import type { Id } from "../../_generated/dataModel";
import { snapshotFields } from "../../documents/schema";
import { summaryAccess } from "./access";
import { validateTranscript } from "./validation";
import { meetingDocumentTitle } from "./title";
import { writeCanonicalDocument } from "./document";
export const sourceArgs = { workspaceId: v.id("workspaces"), meetingId: v.id("meetings") };
export const saveArgs = {
  ...sourceArgs,
  expectedMeetingUpdatedAt: v.number(),
  expectedTranscriptRevision: v.union(v.number(), v.null()),
  expectedDocumentRevision: v.union(v.number(), v.null()),
  expectedDocumentUpdatedAt: v.union(v.number(), v.null()),
  transcript: v.string(),
  language: v.string(),
};
export const get = query({
  args: sourceArgs,
  handler: async (ctx, args) => {
    const { meeting, source, document, user, member, projectMember } = await summaryAccess(
      ctx,
      args.workspaceId,
      args.meetingId
    );
    const canWrite =
      member.role !== "guest" &&
      projectMember?.role !== "guest" &&
      !document?.isLocked &&
      !document?.archived &&
      (!document || (document.access === "private" && document.ownedBy === user._id));
    return {
      canReplaceSource: canWrite && (!document || document.ownedBy === user._id),
      canSummarize: canWrite && Boolean(source),
      meetingUpdatedAt: meeting.updatedAt,
      transcript: source?.source ?? "",
      language: source?.language ?? "",
      transcriptRevision: source?.revision ?? null,
      documentId: document?._id ?? null,
      documentRevision: document?.revision ?? null,
      documentUpdatedAt: document?.updatedAt ?? null,
    };
  },
});
export const commit = internalMutation({
  args: { ...saveArgs, ...snapshotFields },
  handler: async (ctx, args): Promise<Id<"documents">> => {
    const { meeting, source, document, user } = await summaryAccess(ctx, args.workspaceId, args.meetingId, true);
    if (
      meeting.updatedAt !== args.expectedMeetingUpdatedAt ||
      (source?.revision ?? null) !== args.expectedTranscriptRevision ||
      (document?.revision ?? null) !== args.expectedDocumentRevision ||
      (document?.updatedAt ?? null) !== args.expectedDocumentUpdatedAt
    )
      throw new ConvexError("Meeting or transcript changed. Reload before saving.");
    const { transcript } = validateTranscript(args.transcript, args.language);
    const documentId = await writeCanonicalDocument(
      ctx,
      meeting,
      document,
      meetingDocumentTitle(meeting.title, "transcript"),
      {
        summon_transcript_meeting_id: meeting._id,
        summon_document: {
          kind: "summon_meeting_transcript",
          source_transcript: transcript,
          transcription_language: args.language,
        },
      },
      args
    );
    if (source)
      await ctx.db.patch(source._id, {
        source: transcript,
        language: args.language,
        revision: source.revision + 1,
        updatedBy: user._id,
      });
    else
      await ctx.db.insert("meetingTranscripts", {
        meetingId: meeting._id,
        documentId,
        source: transcript,
        language: args.language,
        revision: 1,
        updatedBy: user._id,
      });
    await ctx.db.patch(meeting._id, {
      summaryDocumentId: documentId,
      updatedAt: Math.max(Date.now(), meeting.updatedAt + 1),
      updatedBy: user._id,
    });
    return documentId;
  },
});

export const prepare = internalQuery({
  args: saveArgs,
  handler: async (ctx, args) => {
    const { meeting, source, document } = await summaryAccess(ctx, args.workspaceId, args.meetingId, true);
    if (
      meeting.updatedAt !== args.expectedMeetingUpdatedAt ||
      (source?.revision ?? null) !== args.expectedTranscriptRevision ||
      (document?.revision ?? null) !== args.expectedDocumentRevision ||
      (document?.updatedAt ?? null) !== args.expectedDocumentUpdatedAt
    )
      throw new ConvexError("Meeting or transcript changed. Reload before saving.");
    const snapshot = document
      ? await ctx.db
          .query("documentRevisions")
          .withIndex("by_document_revision", (q) => q.eq("documentId", document._id).eq("revision", document.revision))
          .unique()
      : null;
    if (document && !snapshot) throw new ConvexError("Canonical document snapshot is unavailable.");
    return { title: meetingDocumentTitle(meeting.title, "transcript"), binary: snapshot?.descriptionBinary ?? null };
  },
});
