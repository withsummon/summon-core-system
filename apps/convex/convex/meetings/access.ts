import { ConvexError } from "convex/values";
import type { QueryCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { requireProject, requireWorkspace } from "../identity/access";
export async function canReadMeetingProject(ctx: QueryCtx, projectId: Id<"projects"> | null, userId: Id<"users">) {
  if (!projectId) return true;
  const project = await ctx.db.get(projectId);
  if (!project || project.archived) return false;
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
  const access = await requireWorkspace(ctx, workspaceId, write);
  const meeting = await ctx.db.get(meetingId);
  if (!meeting || meeting.deleted || meeting.workspaceId !== workspaceId)
    throw new ConvexError("Meeting not found in this workspace.");
  if (meeting.projectId) await requireProject(ctx, meeting.projectId, write);
  return { ...access, meeting };
}
