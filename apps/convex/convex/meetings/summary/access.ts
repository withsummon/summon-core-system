import { ConvexError } from "convex/values";
import type { QueryCtx } from "../../_generated/server";
import type { Id } from "../../_generated/dataModel";
import { requireMeeting } from "../access";
import { requireDocument } from "../../documents/access";
export async function summaryAccess(
  ctx: QueryCtx,
  workspaceId: Id<"workspaces">,
  meetingId: Id<"meetings">,
  write = false
) {
  const access = await requireMeeting(ctx, workspaceId, meetingId, write);
  if (!access.meeting.projectId) throw new ConvexError("Choose a project before saving or summarizing a transcript.");
  const source = await ctx.db
    .query("meetingTranscripts")
    .withIndex("by_meeting", (q) => q.eq("meetingId", meetingId))
    .unique();
  if (!source) return { ...access, source: null, document: null };
  const { document } = await requireDocument(ctx, source.documentId, write);
  if (document.workspaceId !== workspaceId || access.meeting.summaryDocumentId !== source.documentId)
    throw new ConvexError("The meeting document link changed. Restore its canonical link before summarizing.");
  if (!document.projectIds.includes(access.meeting.projectId))
    throw new ConvexError("The canonical document must remain linked to the meeting project.");
  if (write && (document.access !== "private" || document.ownedBy !== access.user._id))
    throw new ConvexError(
      "Generated meeting documents must be private and owned by you. Make this document private before continuing."
    );
  if (write && (document.isLocked || document.archived)) throw new ConvexError("Document is locked or archived.");
  return { ...access, source, document };
}
