import { ConvexError } from "convex/values";
import type { QueryCtx } from "../../_generated/server";
import type { Doc, Id } from "../../_generated/dataModel";
import { requireMeetingForUser } from "../access";
import { requireDocumentForUser } from "../../documents/access";
import { requireUser } from "../../identity/access";
export async function summaryAccess(
  ctx: QueryCtx,
  workspaceId: Id<"workspaces">,
  meetingId: Id<"meetings">,
  write = false
) {
  return summaryAccessForUser(ctx, workspaceId, meetingId, await requireUser(ctx), write);
}
export async function summaryAccessForUser(
  ctx: QueryCtx,
  workspaceId: Id<"workspaces">,
  meetingId: Id<"meetings">,
  user: Doc<"users">,
  write = false
) {
  const access = await requireMeetingForUser(ctx, workspaceId, meetingId, user, write);
  if (!access.meeting.projectId) throw new ConvexError("Choose a project before saving or summarizing a transcript.");
  const projectId = access.meeting.projectId;
  const source = await ctx.db
    .query("meetingTranscripts")
    .withIndex("by_meeting", (q) => q.eq("meetingId", meetingId))
    .unique();
  const writer = access.member.role !== "guest" && access.projectMember?.role !== "guest";
  if (!source) return { ...access, projectId, source: null, document: null, canWrite: writer };
  const { document } = await requireDocumentForUser(ctx, source.documentId, user, write);
  if (document.workspaceId !== workspaceId || access.meeting.summaryDocumentId !== source.documentId)
    throw new ConvexError("The meeting document link changed. Restore its canonical link before summarizing.");
  if (!document.projectIds.includes(access.meeting.projectId))
    throw new ConvexError("The canonical document must remain linked to the meeting project.");
  if (write && (document.access !== "private" || document.ownedBy !== access.user._id))
    throw new ConvexError(
      "Generated meeting documents must be private and owned by you. Make this document private before continuing."
    );
  if (write && (document.isLocked || document.archived)) throw new ConvexError("Document is locked or archived.");
  const writableDocument =
    document.access === "private" && document.ownedBy === user._id && !document.isLocked && !document.archived;
  return { ...access, projectId, source, document, canWrite: writer && writableDocument };
}
