import { ConvexError } from "convex/values";
import type { QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { requireWorkspace, requireProject } from "../identity/access";
import { canAccessDocument } from "../documents/access";
import { canReadMeetingProject } from "../meetings/access";
import { authorizedContext } from "../assistant/context";
export async function requireJob(ctx: QueryCtx, jobId: Id<"automationJobs">, write = false) {
  const job = await ctx.db.get(jobId);
  if (!job) throw new ConvexError("Generation job not found.");
  const access = await requireWorkspace(ctx, job.workspaceId, write);
  if (access.user._id !== job.requesterId) throw new ConvexError("Generation job access denied.");
  await requireProject(ctx, job.projectId, write);
  await authorizedContext(ctx, job.workspaceId, job.context);
  return { ...access, job };
}

// Workspace membership and requester identity are established by the indexed list owner.
export async function canReadJob(ctx: QueryCtx, job: Doc<"automationJobs">, userId: Id<"users">) {
  if (!(await canReadMeetingProject(ctx, job.projectId, userId))) return false;
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
