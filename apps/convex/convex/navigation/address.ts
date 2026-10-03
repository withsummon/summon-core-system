import { projectIdentifierSchema } from "../projects/metadata_fields";
import { ConvexError, v } from "convex/values";
import { query } from "../_generated/server";
import type { QueryCtx } from "../_generated/server";
import type { Doc } from "../_generated/dataModel";
import { requireUser, requireWorkspace, requireProject } from "../identity/access";
import { taskCanRead, taskDetail } from "../tasks/access";
import { intakeCapabilities } from "../intakes/access";
import { renderedProjectLogo } from "../projects/branding_schema";
import { requireMeeting } from "../meetings/access";
import { projectReader } from "../savedViews/scope";

async function workspaceAddress(ctx: QueryCtx, workspaceSlug: string) {
  await requireUser(ctx);
  const workspace = await ctx.db
    .query("workspaces")
    .withIndex("by_slug", (q) => q.eq("slug", workspaceSlug))
    .unique();
  if (!workspace) throw new ConvexError("Workspace not found.");
  return requireWorkspace(ctx, workspace._id);
}
async function projectAddress(ctx: QueryCtx, workspaceSlug: string, projectIdentifier: string) {
  const access = await workspaceAddress(ctx, workspaceSlug);
  const project = await ctx.db
    .query("projects")
    .withIndex("by_workspace_identifier", (q) =>
      q.eq("workspaceId", access.workspace._id).eq("identifier", projectIdentifier.toUpperCase())
    )
    .unique();
  if (!project) throw new ConvexError("Project not found.");
  return requireProject(ctx, project._id);
}
export const resolveWorkspace = query({
  args: { workspaceSlug: v.string() },
  handler: async (ctx, args) => {
    const { workspace, member } = await workspaceAddress(ctx, args.workspaceSlug);
    return { workspace, role: member.role };
  },
});
export const resolveProject = query({
  args: { workspaceSlug: v.string(), projectIdentifier: v.string() },
  handler: async (ctx, args) => {
    const { workspace, project, member, projectMember } = await projectAddress(
      ctx,
      args.workspaceSlug,
      args.projectIdentifier
    );
    return { workspace, project, workspaceRole: member.role, projectRole: projectMember.role };
  },
});
export const resolveProjectId = query({
  args: { workspaceId: v.id("workspaces"), projectId: v.string() },
  handler: async (ctx, args) => {
    const projectId = ctx.db.normalizeId("projects", args.projectId);
    if (!projectId) throw new ConvexError("Project not found.");
    const { workspace, project, member, projectMember } = await requireProject(ctx, projectId);
    if (workspace._id !== args.workspaceId) throw new ConvexError("Project not found.");
    return { workspace, project, workspaceRole: member.role, projectRole: projectMember.role };
  },
});
export const resolveTask = query({
  args: { workspaceSlug: v.string(), workItem: v.string() },
  handler: async (ctx, args) => {
    const access = await workspaceAddress(ctx, args.workspaceSlug);
    const match = /^(.+)-([0-9]+)$/.exec(args.workItem);
    if (!match || match[1] !== match[1].trim()) return null;
    const sequence = Number(match[2]);
    const identifier = projectIdentifierSchema.safeParse(match[1]);
    if (!Number.isSafeInteger(sequence) || sequence < 1 || !identifier.success) return null;
    const project = await ctx.db
      .query("projects")
      .withIndex("by_workspace_identifier", (q) =>
        q.eq("workspaceId", access.workspace._id).eq("identifier", identifier.data)
      )
      .unique();
    const readable = project ? await projectReader(ctx, access.workspace._id, access.user._id)(project._id) : null;
    if (!readable) return null;
    const task = await ctx.db
      .query("tasks")
      .withIndex("by_project_sequence", (q) => q.eq("projectId", readable.project._id).eq("sequence", sequence))
      .unique();
    return task
      ? taskAddress(ctx, { ...access, project: readable.project, projectMember: readable.member }, task)
      : null;
  },
});

export const resolveTaskId = query({
  args: { workspaceId: v.id("workspaces"), projectId: v.string(), taskId: v.string() },
  handler: async (ctx, args) => {
    const access = await requireWorkspace(ctx, args.workspaceId);
    const projectId = ctx.db.normalizeId("projects", args.projectId);
    const readable = projectId ? await projectReader(ctx, args.workspaceId, access.user._id)(projectId) : null;
    if (!readable) return null;
    const taskId = ctx.db.normalizeId("tasks", args.taskId);
    const task = taskId ? await ctx.db.get(taskId) : null;
    return task
      ? taskAddress(ctx, { ...access, project: readable.project, projectMember: readable.member }, task)
      : null;
  },
});

async function taskAddress(ctx: QueryCtx, access: Awaited<ReturnType<typeof requireProject>>, task: Doc<"tasks">) {
  const { user, workspace, project } = access;
  if (task.workspaceId !== workspace._id || task.projectId !== project._id) return null;
  const address = {
    workspace: { id: workspace._id, slug: workspace.slug, name: workspace.name },
    project,
    projectLogo: renderedProjectLogo(project.logoProps ?? {}),
    workItem: `${project.identifier}-${task.sequence}`,
  };
  if (task.status === "triage") {
    if (task.deletedAt !== null || task.archivedAt !== null) return null;
    const intake = await ctx.db
      .query("intakeTasks")
      .withIndex("by_task", (q) => q.eq("taskId", task._id))
      .unique();
    if (!intake || intake.deletedAt !== null || !intakeCapabilities(access, intake.createdBy).canRead) return null;
    return { ...address, kind: "intake" as const, intake: { taskId: intake.taskId, status: intake.status } };
  }
  if (!(await taskCanRead(ctx, task, user._id))) return null;
  return { ...address, kind: "task" as const, task: await taskDetail(ctx, { ...task, status: task.status }, access) };
}

export const resolveMeetingId = query({
  args: { workspaceId: v.id("workspaces"), meetingId: v.string() },
  handler: async (ctx, args) => {
    const meetingId = ctx.db.normalizeId("meetings", args.meetingId);
    if (!meetingId) throw new ConvexError("Meeting not found.");
    const { meeting, member, projectMember } = await requireMeeting(ctx, args.workspaceId, meetingId);
    const organizer = await ctx.db.get(meeting.organizerId);
    return {
      meeting,
      project: meeting.projectId ? await ctx.db.get(meeting.projectId) : null,
      organizerName: organizer?.name ?? organizer?.email ?? null,
      canWrite: member.role !== "guest" && projectMember?.role !== "guest",
    };
  },
});
