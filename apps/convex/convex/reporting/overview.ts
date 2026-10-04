import { taskIsActive, taskCanRead, readableTasks } from "../tasks/access";
import { paginationOptsValidator } from "convex/server";
import { stream } from "convex-helpers/server/stream";
import { v } from "convex/values";
import { query } from "../_generated/server";
import { requireProject } from "../identity/access";
import { canAccessDocument } from "../documents/access";
import { directoryPerson } from "../projects/directory";
import { deliveryStatus, projectHealth } from "../commercial/schema";
import { pageBudget, parseProfile, newProjectProfile } from "../commercial/validation";
import { descriptor } from "../assets/access";
import schema from "../schema";

export const project = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, { projectId }) => {
    const access = await requireProject(ctx, projectId);
    const [storedProfile, tasks, lead] = await Promise.all([
      ctx.db
        .query("projectProfiles")
        .withIndex("by_project", (q) => q.eq("projectId", projectId))
        .unique(),
      ctx.db
        .query("tasks")
        .withIndex("by_project", (q) => q.eq("projectId", projectId))
        .order("desc")
        .paginate({ cursor: null, numItems: 100, maximumRowsRead: 100, maximumBytesRead: 1_000_000 }),
      access.project.leadId
        ? directoryPerson(ctx, access.project.leadId, access.workspace._id, access.member.role)
        : null,
    ]);
    const profile = storedProfile && !storedProfile.deleted ? storedProfile : null;
    const client = profile?.clientId ? await ctx.db.get(profile.clientId) : null;
    const opportunity = profile?.sourceOpportunityId ? await ctx.db.get(profile.sourceOpportunityId) : null;
    return {
      project: access.project,
      profile,
      profileForm: parseProfile(profile ?? newProjectProfile),
      client: client && !client.deleted && client.workspaceId === access.workspace._id ? client : null,
      sourceOpportunity:
        opportunity && !opportunity.deleted && opportunity.workspaceId === access.workspace._id ? opportunity : null,
      lead,
      canWrite: access.member.role !== "guest" && access.projectMember.role !== "guest",
      canManage: access.member.role !== "guest" && access.projectMember.role === "admin",
      options: {
        deliveryStatus: deliveryStatus.members.map((entry) => entry.value),
        health: projectHealth.members.map((entry) => entry.value),
      },
      recentTasks: (await readableTasks(ctx, tasks.page.filter(taskIsActive), access.user._id))
        .slice(0, 20)
        .map((task) => ({
          id: task._id,
          title: task.title,
          sequence: task.sequence,
          status: task.status,
          targetDate: task.targetDate,
        })),
      coverage: {
        recentTasksLimit: 20,
        scannedTaskCandidates: tasks.page.length,
        hasMoreTaskCandidates: !tasks.isDone,
      },
    };
  },
});
const projectPage = { projectId: v.id("projects"), paginationOpts: paginationOptsValidator };
export const resources = query({
  args: projectPage,
  handler: async (ctx, args) => {
    const { project: selectedProject, user } = await requireProject(ctx, args.projectId);
    return stream(ctx.db, schema)
      .query("resources")
      .withIndex("by_workspace_updated", (q) => q.eq("workspaceId", selectedProject.workspaceId).eq("deleted", false))
      .order("desc")
      .map(async (resource) => {
        if (resource.projectId !== args.projectId) return null;
        const document = resource.documentId ? await ctx.db.get(resource.documentId) : null;
        if (resource.documentId && (!document || !(await canAccessDocument(ctx, document, user._id)))) return null;
        return {
          _id: resource._id,
          title: resource.title,
          category: resource.category,
          url: resource.url,
          description: resource.description,
        };
      })
      .paginate(pageBudget(args.paginationOpts));
  },
});
export const activity = query({
  args: projectPage,
  handler: async (ctx, args) => {
    const { project: selectedProject, user } = await requireProject(ctx, args.projectId);
    return stream(ctx.db, schema)
      .query("taskEvents")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", selectedProject.workspaceId))
      .order("desc")
      .map(async (event) => {
        if (event.projectId !== args.projectId) return null;
        const task = await ctx.db.get(event.taskId);
        if (!task || task.deletedAt !== null || !(await taskCanRead(ctx, task, user._id))) return null;
        return { _id: event._id, taskId: task._id, title: task.title, kind: event.kind, at: event._creationTime };
      })
      .paginate(pageBudget(args.paginationOpts));
  },
});
export const files = query({
  args: projectPage,
  handler: async (ctx, args) => {
    const { project: selectedProject, user } = await requireProject(ctx, args.projectId);
    return stream(ctx.db, schema)
      .query("assets")
      .withIndex("by_workspace_purpose_status", (q) =>
        q.eq("workspaceId", selectedProject.workspaceId).eq("purpose", undefined).eq("status", "ready")
      )
      .order("desc")
      .map(async (asset) => {
        if ([asset.draftId, asset.conversationId, asset.documentCopyId, asset.automationJobId].some(Boolean))
          return null;
        const task = asset.taskId ? await ctx.db.get(asset.taskId) : null;
        if (asset.projectId !== args.projectId && task?.projectId !== args.projectId) return null;
        if (asset.taskId && (!task || !taskIsActive(task) || !(await taskCanRead(ctx, task, user._id)))) return null;
        const document = asset.documentId ? await ctx.db.get(asset.documentId) : null;
        if (asset.documentId && (!document || !(await canAccessDocument(ctx, document, user._id)))) return null;
        const meeting = asset.meetingId ? await ctx.db.get(asset.meetingId) : null;
        if (asset.meetingId && (!meeting || meeting.deleted || meeting.projectId !== args.projectId)) return null;
        return Object.assign(descriptor(asset), { createdAt: asset._creationTime });
      })
      .paginate(pageBudget(args.paginationOpts));
  },
});
