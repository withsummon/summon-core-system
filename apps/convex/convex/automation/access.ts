import { ConvexError } from "convex/values";
import type { QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { requireWorkspace, requireProject } from "../identity/access";
import { canAccessDocument } from "../documents/access";
import { canReadMeetingProject } from "../meetings/access";
import { authorizedContext } from "../assistant/context";
export async function requireJob(ctx: QueryCtx, jobId: Id<"automationJobs">, write = false) {
  const job = await ctx.db.get(jobId);
  if (!job || job.deletedAt !== undefined) throw new ConvexError("Generation job not found.");
  const access = await requireWorkspace(ctx, job.workspaceId, write);
  if (access.user._id !== job.requesterId) throw new ConvexError("Generation job access denied.");
  await requireProject(ctx, job.projectId, write);
  await authorizedContext(ctx, job.workspaceId, job.context);
  if (!(await canReadJob(ctx, job, access.user._id))) throw new ConvexError("Generation sources are unavailable.");
  return { ...access, job };
}

// Workspace membership and requester identity are established by the indexed list owner.
export async function canReadJob(ctx: QueryCtx, job: Doc<"automationJobs">, userId: Id<"users">) {
  if (job.deletedAt !== undefined) return false;
  if (!(await canReadMeetingProject(ctx, job.projectId, userId))) return false;
  if (!(await canReadJobAttachments(ctx, job, userId))) return false;
  if (job.context.clientId) {
    const client = await ctx.db.get(job.context.clientId);
    if (!client || client.deleted || client.workspaceId !== job.workspaceId) return false;
  }
  if (job.context.meetingId) {
    const meeting = await ctx.db.get(job.context.meetingId);
    if (
      !meeting ||
      meeting.deleted ||
      meeting.workspaceId !== job.workspaceId ||
      !(await canReadMeetingProject(ctx, meeting.projectId, userId))
    )
      return false;
    const transcript = await ctx.db
      .query("meetingTranscripts")
      .withIndex("by_meeting", (q) => q.eq("meetingId", meeting._id))
      .unique();
    if (transcript) {
      const document = await ctx.db.get(transcript.documentId);
      if (!document || document.archived || !(await canAccessDocument(ctx, document, userId))) return false;
    }
  }
  const documents = await Promise.all(
    job.context.documentIds.map(async (id) => {
      const document = await ctx.db.get(id);
      return Boolean(
        document &&
        document.workspaceId === job.workspaceId &&
        !document.archived &&
        (await canAccessDocument(ctx, document, userId))
      );
    })
  );
  return documents.every(Boolean);
}

async function canReadJobAttachments(ctx: QueryCtx, job: Doc<"automationJobs">, userId: Id<"users">) {
  if (job.sourceConversationId) {
    const conversation = await ctx.db.get(job.sourceConversationId);
    if (
      !conversation ||
      conversation.deleted ||
      conversation.ownerId !== userId ||
      conversation.workspaceId !== job.workspaceId
    )
      return false;
  }
  const files = await Promise.all(
    (job.sourceAttachmentIds ?? []).map(async (id) => {
      const file = await ctx.db.get(id);
      const asset = file ? await ctx.db.get(file.assetId) : null;
      return Boolean(
        file &&
        !file.deleted &&
        file.status === "ready" &&
        file.conversationId === job.sourceConversationId &&
        asset?.status === "ready"
      );
    })
  );
  if (!files.every(Boolean)) return false;
  return true;
}
