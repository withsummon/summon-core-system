import { projectIdentifier as validateIdentifier } from "../projects/metadata_fields";
import { ConvexError, v } from "convex/values";
import { query } from "../_generated/server";
import type { QueryCtx } from "../_generated/server";
import { requireUser, requireWorkspace, requireProject } from "../identity/access";
import { taskCanRead, taskDetail } from "../tasks/access";

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
    const match = /^(.+)-([0-9]+)$/.exec(args.workItem);
    if (!match || match[1] !== match[1].trim()) throw new ConvexError("Invalid task address.");
    const sequence = Number(match[2]);
    if (!Number.isSafeInteger(sequence) || sequence < 1) throw new ConvexError("Invalid task address.");
    const { user, workspace, project } = await projectAddress(
      ctx,
      args.workspaceSlug,
      validateIdentifier(match[1], "Invalid task address.")
    );
    const task = await ctx.db
      .query("tasks")
      .withIndex("by_project_sequence", (q) => q.eq("projectId", project._id).eq("sequence", sequence))
      .unique();
    if (
      !task ||
      task.workspaceId !== workspace._id ||
      task.status === "triage" ||
      !(await taskCanRead(ctx, task, user._id))
    )
      return null;
    return {
      workspace: { id: workspace._id, slug: workspace.slug, name: workspace.name },
      project: { id: project._id, identifier: project.identifier, name: project.name },
      workItem: `${project.identifier}-${task.sequence}`,
      task: await taskDetail(ctx, { ...task, status: task.status }),
    };
  },
});
