import { ConvexError, v } from "convex/values";
import { query, internalQuery, internalMutation } from "../../_generated/server";
import type { Doc, Id } from "../../_generated/dataModel";
import type { Infer } from "convex/values";
import type { MutationCtx, QueryCtx } from "../../_generated/server";
import { requireUser } from "../../identity/access";
import { snapshotFields } from "../../documents/schema";
import { summaryAccessForUser } from "./access";
import { requireMeeting } from "../access";
import { sourceArgs, versionFields } from "./schema";
import { validateTranscript } from "./validation";
import { meetingDocumentTitle } from "./title";
import { writeCanonicalDocument } from "./document";
export { sourceArgs } from "./schema";
export const saveArgs = {
  ...sourceArgs,
  ...versionFields,
  transcript: v.string(),
  language: v.string(),
};
export const get = query({
  args: sourceArgs,
  handler: async (ctx, args) => {
    const access = await requireMeeting(ctx, args.workspaceId, args.meetingId);
    if (!access.meeting.projectId)
      return { available: false as const, reason: "project_required" as const, canGenerateDocument: false };
    let summary: Awaited<ReturnType<typeof summaryAccessForUser>>;
    try {
      summary = await summaryAccessForUser(ctx, args.workspaceId, args.meetingId, access.user);
    } catch (error) {
      if (error instanceof ConvexError)
        return { available: false as const, reason: "document_unavailable" as const, canGenerateDocument: false };
      throw error;
    }
    const { meeting, source, document, canWrite } = summary;
    return {
      available: true as const,
      canGenerateDocument: await documentGenerationReady(ctx, summary),
      canReplaceSource: canWrite,
      canSummarize: canWrite && Boolean(source),
      meetingUpdatedAt: meeting.updatedAt,
      transcript: source?.source ?? "",
      language: source?.language ?? "",
      ...(source && document
        ? {
            hasTranscript: true as const,
            transcriptRevision: source.revision,
            documentId: document._id,
            documentRevision: document.revision,
            documentUpdatedAt: document.updatedAt,
          }
        : {
            hasTranscript: false as const,
            transcriptRevision: null,
            documentId: null,
            documentRevision: null,
            documentUpdatedAt: null,
          }),
    };
  },
});
const commitArgs = v.object({ ...saveArgs, ...snapshotFields });
export async function commitTranscript(
  ctx: MutationCtx,
  args: Infer<typeof commitArgs>,
  user: Doc<"users">
): Promise<Id<"documents">> {
  const { meeting, source, document } = await requireTranscriptVersion(ctx, args, user);
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
    args,
    user
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
}
export const commit = internalMutation({
  args: commitArgs.fields,
  handler: async (ctx, args): Promise<Id<"documents">> => commitTranscript(ctx, args, await requireUser(ctx)),
});

const prepareArgs = v.object({ ...sourceArgs, ...versionFields });
export async function requireTranscriptVersion(ctx: QueryCtx, args: Infer<typeof prepareArgs>, user: Doc<"users">) {
  const { meeting, source, document } = await summaryAccessForUser(ctx, args.workspaceId, args.meetingId, user, true);
  if (
    meeting.updatedAt !== args.expectedMeetingUpdatedAt ||
    (source?.revision ?? null) !== args.expectedTranscriptRevision ||
    (document?.revision ?? null) !== args.expectedDocumentRevision ||
    (document?.updatedAt ?? null) !== args.expectedDocumentUpdatedAt
  )
    throw new ConvexError("Meeting or transcript changed. Reload before saving.");
  return { meeting, source, document };
}

export async function prepareTranscript(ctx: QueryCtx, args: Infer<typeof prepareArgs>, user: Doc<"users">) {
  const { meeting, document } = await requireTranscriptVersion(ctx, args, user);
  const snapshot = document
    ? await ctx.db
        .query("documentRevisions")
        .withIndex("by_document_revision", (q) => q.eq("documentId", document._id).eq("revision", document.revision))
        .unique()
    : null;
  if (document && !snapshot) throw new ConvexError("Canonical document snapshot is unavailable.");
  return { title: meetingDocumentTitle(meeting.title, "transcript"), binary: snapshot?.descriptionBinary ?? null };
}
export const prepare = internalQuery({
  args: saveArgs,
  handler: async (ctx, args) => prepareTranscript(ctx, args, await requireUser(ctx)),
});

export async function documentGenerationReady(
  ctx: QueryCtx,
  { meeting, source, document }: Awaited<ReturnType<typeof summaryAccessForUser>>
) {
  if (!source || !document) return false;
  const latest = await ctx.db
    .query("meetingTranscriptionRuns")
    .withIndex("by_meeting", (q) => q.eq("input.meetingId", meeting._id))
    .order("desc")
    .first();
  return !latest || !["queued", "running"].includes(latest.status);
}
