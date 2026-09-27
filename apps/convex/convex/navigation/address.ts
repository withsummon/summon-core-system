import { ConvexError, v } from "convex/values";
import { query } from "../_generated/server";
import type { QueryCtx } from "../_generated/server";
import { requireUser, requireWorkspace, requireProject } from "../identity/access";
import { requireTask, taskDetail } from "../tasks/access";

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
export const resolveTask = query({
  args: { workspaceSlug: v.string(), workItem: v.string() },
  handler: async (ctx, args) => {
    const match = /^([a-zA-Z][a-zA-Z0-9]{1,9})-([0-9]+)$/.exec(args.workItem);
    if (!match) throw new ConvexError("Invalid task address.");
    const sequence = Number(match[2]);
    if (!Number.isSafeInteger(sequence) || sequence < 1) throw new ConvexError("Invalid task address.");
    const { workspace, project } = await projectAddress(ctx, args.workspaceSlug, match[1]);
    const task = await ctx.db
      .query("tasks")
      .withIndex("by_project_sequence", (q) => q.eq("projectId", project._id).eq("sequence", sequence))
      .unique();
    if (!task || task.workspaceId !== workspace._id) throw new ConvexError("Task not found.");
    const readable = await requireTask(ctx, task._id, "read");
    return {
      workspace: { id: workspace._id, slug: workspace.slug, name: workspace.name },
      project: { id: project._id, identifier: project.identifier, name: project.name },
      workItem: `${project.identifier}-${task.sequence}`,
      task: await taskDetail(ctx, readable),
    };
  },
});
