import { ConvexError, v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { stream } from "convex-helpers/server/stream";
import type { MutationCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { mutation, query } from "../_generated/server";
import { requireProject, requireWorkspace } from "../identity/access";
import { requireDocument } from "../documents/access";
import { text, pageBudget } from "../commercial/validation";
import { meetingFields } from "./schema";
import { requireMeeting, canReadMeetingProject } from "./access";
import schema from "../schema";

async function validateMeeting(
  ctx: MutationCtx,
  workspaceId: Id<"workspaces">,
  data: Pick<Doc<"meetings">, keyof typeof meetingFields>,
  existing: Doc<"meetings"> | null
) {
  const title = text(data.title, "Title", 255, true);
  const agenda = text(data.agenda, "Agenda", 100000);
  const notes = text(data.notes, "Notes", 100000);
  const location = text(data.location, "Location", 255);
  const meetingUrl = text(data.meetingUrl, "Meeting URL", 200);
  if (meetingUrl) {
    let url: URL;
    try {
      url = new URL(meetingUrl);
    } catch {
      throw new ConvexError("Enter a valid meeting URL.");
    }
    if (!["http:", "https:"].includes(url.protocol)) throw new ConvexError("Enter an HTTP or HTTPS meeting URL.");
  }
  if (
    ![data.startsAt, data.endsAt].every(
      (value) => value === null || (Number.isSafeInteger(value) && Number.isFinite(new Date(value).getTime()))
    )
  )
    throw new ConvexError("Enter valid meeting timestamps in milliseconds.");
  if (data.endsAt !== null && data.endsAt < data.startsAt)
    throw new ConvexError("End time must not be before start time.");
  if (data.projectId) {
    const { project } = await requireProject(ctx, data.projectId, true);
    if (project.workspaceId !== workspaceId) throw new ConvexError("Project belongs to another workspace.");
  }
  if (data.summaryDocumentId && data.summaryDocumentId !== existing?.summaryDocumentId) {
    const { document } = await requireDocument(ctx, data.summaryDocumentId);
    if (document.workspaceId !== workspaceId) throw new ConvexError("Summary document belongs to another workspace.");
  }
  return { ...data, title, agenda, notes, location, meetingUrl };
}
async function replaceParticipants(
  ctx: MutationCtx,
  workspaceId: Id<"workspaces">,
  meetingId: Id<"meetings">,
  userIds: Id<"users">[]
) {
  if (userIds.length > 200 || new Set(userIds).size !== userIds.length)
    throw new ConvexError("Choose up to 200 distinct participants.");
  await Promise.all(
    userIds.map(async (userId) => {
      const membership = await ctx.db
        .query("workspaceMembers")
        .withIndex("by_workspace_user", (q) => q.eq("workspaceId", workspaceId).eq("userId", userId))
        .unique();
      if (!membership?.active) throw new ConvexError("Participants must be active workspace members.");
    })
  );
  const existing = await ctx.db
    .query("meetingParticipants")
    .withIndex("by_meeting_user", (q) => q.eq("meetingId", meetingId))
    .collect();
  const requested = new Set(userIds);
  const retained = new Set(existing.map((participant) => participant.userId));
  await Promise.all(
    existing
      .filter((participant) => !requested.has(participant.userId))
      .map((participant) => ctx.db.delete(participant._id))
  );
  await Promise.all(
    userIds
      .filter((userId) => !retained.has(userId))
      .map((userId) => ctx.db.insert("meetingParticipants", { workspaceId, meetingId, userId, response: "pending" }))
  );
}
export const save = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    meetingId: v.optional(v.id("meetings")),
    expectedUpdatedAt: v.optional(v.number()),
    data: v.object(meetingFields),
    participantIds: v.array(v.id("users")),
  },
  handler: async (ctx, args) => {
    const { user } = await requireWorkspace(ctx, args.workspaceId, true);
    const existing = args.meetingId
      ? (await requireMeeting(ctx, args.workspaceId, args.meetingId, true)).meeting
      : null;
    const data = await validateMeeting(ctx, args.workspaceId, args.data, existing);
    if (existing && existing.projectId !== data.projectId) {
      const linked = await ctx.db
        .query("meetingTasks")
        .withIndex("by_meeting_task", (q) => q.eq("meetingId", existing._id))
        .first();
      if (linked) throw new ConvexError("Unlink meeting tasks before changing its project.");
    }
    if (existing && args.expectedUpdatedAt !== existing.updatedAt)
      throw new ConvexError("Meeting changed while you were editing. Cancel and reopen before saving.");
    if (existing) {
      const transcript = await ctx.db
        .query("meetingTranscripts")
        .withIndex("by_meeting", (q) => q.eq("meetingId", existing._id))
        .unique();
      if (transcript && (data.summaryDocumentId !== transcript.documentId || data.projectId !== existing.projectId))
        throw new ConvexError("A meeting with a transcript must keep its canonical document and project.");
    }
    const updated = { ...data, updatedAt: Math.max(Date.now(), (existing?.updatedAt ?? 0) + 1), updatedBy: user._id };
    const meetingId =
      args.meetingId ??
      (await ctx.db.insert("meetings", {
        ...updated,
        workspaceId: args.workspaceId,
        organizerId: user._id,
        deleted: false,
      }));
    if (args.meetingId) await ctx.db.patch(meetingId, updated);
    await replaceParticipants(ctx, args.workspaceId, meetingId, args.participantIds);
    return meetingId;
  },
});
export const get = query({
  args: { workspaceId: v.id("workspaces"), meetingId: v.id("meetings") },
  handler: async (ctx, args) => (await requireMeeting(ctx, args.workspaceId, args.meetingId)).meeting,
});
export const list = query({
  args: { workspaceId: v.id("workspaces"), paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const { user } = await requireWorkspace(ctx, args.workspaceId);
    return stream(ctx.db, schema)
      .query("meetings")
      .withIndex("by_workspace_start", (q) => q.eq("workspaceId", args.workspaceId).eq("deleted", false))
      .order("desc")
      .filterWith((meeting) => canReadMeetingProject(ctx, meeting.projectId, user._id))
      .paginate(pageBudget(args.paginationOpts));
  },
});
export const participants = query({
  args: { workspaceId: v.id("workspaces"), meetingId: v.id("meetings") },
  handler: async (ctx, args) => {
    await requireMeeting(ctx, args.workspaceId, args.meetingId);
    const rows = await ctx.db
      .query("meetingParticipants")
      .withIndex("by_meeting_user", (q) => q.eq("meetingId", args.meetingId))
      .collect();
    return Promise.all(
      rows.map(async (participant) => {
        const user = await ctx.db.get(participant.userId);
        return {
          id: participant._id,
          userId: participant.userId,
          response: participant.response,
          name: user?.name ?? null,
          email: user?.email ?? null,
        };
      })
    );
  },
});
export const remove = mutation({
  args: { workspaceId: v.id("workspaces"), meetingId: v.id("meetings") },
  handler: async (ctx, args) => {
    const { user, meeting } = await requireMeeting(ctx, args.workspaceId, args.meetingId, true);
    await ctx.db.patch(args.meetingId, {
      deleted: true,
      updatedAt: Math.max(Date.now(), meeting.updatedAt + 1),
      updatedBy: user._id,
    });
  },
});
