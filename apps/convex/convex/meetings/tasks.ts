import { ConvexError, v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { mutation, query } from "../_generated/server";
import { requireProject } from "../identity/access";
import { pageBudget } from "../commercial/validation";
import { requireMeeting, canReadMeetingProject } from "./access";

// Linking only references canonical tasks. No duplicate task title/status and no automatic task creation.
export const link = mutation({
  args: { workspaceId: v.id("workspaces"), meetingId: v.id("meetings"), taskId: v.id("tasks") },
  handler: async (ctx, args) => {
    const { meeting, user } = await requireMeeting(ctx, args.workspaceId, args.meetingId, true);
    const task = await ctx.db.get(args.taskId);
    if (!task || task.workspaceId !== args.workspaceId) throw new ConvexError("Task not found in this workspace.");
    if (meeting.projectId && task.projectId !== meeting.projectId)
      throw new ConvexError("Task must belong to the meeting project.");
    await requireProject(ctx, task.projectId, true);
    const existing = await ctx.db
      .query("meetingTasks")
      .withIndex("by_meeting_task", (q) => q.eq("meetingId", args.meetingId).eq("taskId", args.taskId))
      .unique();
    if (existing) throw new ConvexError("Task is already linked to this meeting.");
    return ctx.db.insert("meetingTasks", { ...args, createdBy: user._id });
  },
});
export const list = query({
  args: { workspaceId: v.id("workspaces"), meetingId: v.id("meetings"), paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const { user } = await requireMeeting(ctx, args.workspaceId, args.meetingId);
    const result = await ctx.db
      .query("meetingTasks")
      .withIndex("by_meeting_task", (q) => q.eq("meetingId", args.meetingId))
      .paginate(pageBudget(args.paginationOpts));
    const visible = await Promise.all(
      result.page.map(async (relationship) => {
        const task = await ctx.db.get(relationship.taskId);
        if (!task || !(await canReadMeetingProject(ctx, task.projectId, user._id))) return null;
        return { linkId: relationship._id, task };
      })
    );
    return { ...result, page: visible.filter((relationship) => relationship !== null) };
  },
});
export const unlink = mutation({
  args: { workspaceId: v.id("workspaces"), meetingId: v.id("meetings"), linkId: v.id("meetingTasks") },
  handler: async (ctx, args) => {
    await requireMeeting(ctx, args.workspaceId, args.meetingId, true);
    const relationship = await ctx.db.get(args.linkId);
    if (!relationship || relationship.meetingId !== args.meetingId)
      throw new ConvexError("Meeting task link not found.");
    await ctx.db.delete(args.linkId);
  },
});
