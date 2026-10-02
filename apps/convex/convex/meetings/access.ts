import { ConvexError } from "convex/values";
import type { QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { requireProjectForUser, requireWorkspaceForUser, requireUser } from "../identity/access";
export async function canReadMeetingProject(ctx: QueryCtx, projectId: Id<"projects"> | null, userId: Id<"users">) {
  if (!projectId) return true;
  const project = await ctx.db.get(projectId);
  if (!project || project.archived || project.deletedAt != null) return false;
  const workspace = await ctx.db.get(project.workspaceId);
  if (!workspace || workspace.deletedAt != null) return false;
  const member = await ctx.db
    .query("projectMembers")
    .withIndex("by_project_user", (q) => q.eq("projectId", projectId).eq("userId", userId))
    .unique();
  return Boolean(member?.active);
}
export async function requireMeeting(
  ctx: QueryCtx,
  workspaceId: Id<"workspaces">,
  meetingId: Id<"meetings">,
  write = false
) {
  return requireMeetingForUser(ctx, workspaceId, meetingId, await requireUser(ctx), write);
}
export async function requireMeetingForUser(
  ctx: QueryCtx,
  workspaceId: Id<"workspaces">,
  meetingId: Id<"meetings">,
  user: Doc<"users">,
  write = false
) {
  const access = await requireWorkspaceForUser(ctx, workspaceId, user, write);
  const meeting = await ctx.db.get(meetingId);
  if (!meeting || meeting.deleted || meeting.workspaceId !== workspaceId)
    throw new ConvexError("Meeting not found in this workspace.");
  const projectAccess = meeting.projectId ? await requireProjectForUser(ctx, meeting.projectId, user, write) : null;
  return { ...access, meeting, projectMember: projectAccess?.projectMember ?? null };
}
