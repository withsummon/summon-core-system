import { ConvexError } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { requireProject } from "../identity/access";
export function taskIsActive(task: Doc<"tasks">) {
  return task.status !== "triage" && task.deletedAt === null && task.archivedAt === null;
}
export function taskIsReadable(task: Doc<"tasks">) {
  return task.status !== "triage" && task.deletedAt === null;
}
export function taskRoleCanRead(
  task: Pick<Doc<"tasks">, "createdBy">,
  userId: Id<"users">,
  workspaceRole: string,
  projectRole: string,
  guestViewAllFeatures: boolean
) {
  return (workspaceRole !== "guest" && projectRole !== "guest") || guestViewAllFeatures || task.createdBy === userId;
}
export async function requireTask(ctx: QueryCtx, taskId: Id<"tasks">, mode: "active" | "read" | "recovery" = "active") {
  const task = await ctx.db.get(taskId);
  if (
    !task ||
    task.status === "triage" ||
    (mode === "active" && !taskIsActive(task)) ||
    (mode === "read" && !taskIsReadable(task))
  )
    throw new ConvexError("Task not found.");
  const access = await requireProject(ctx, task.projectId);
  if (
    mode !== "recovery" &&
    !taskRoleCanRead(
      task,
      access.user._id,
      access.member.role,
      access.projectMember.role,
      !!access.project.guestViewAllFeatures
    )
  )
    throw new ConvexError("Task not found.");
  if (mode === "recovery") {
    if (task.createdBy !== access.user._id && access.projectMember.role !== "admin")
      throw new ConvexError("Only the creator or a project administrator can recover this task.");
  }
  return { ...task, status: task.status };
}

export async function taskDetail(ctx: QueryCtx, task: Awaited<ReturnType<typeof requireTask>>) {
  const { user, member, projectMember } = await requireProject(ctx, task.projectId);
  const writer = member.role !== "guest" && projectMember.role !== "guest";
  const recovery = task.createdBy === user._id || projectMember.role === "admin";
  return {
    ...task,
    archivedAt: task.archivedAt ?? null,
    deletedAt: task.deletedAt ?? null,
    canEdit: writer && taskIsActive(task),
    canArchive: writer && taskIsActive(task) && (task.status === "done" || task.status === "cancelled"),
    canDelete: recovery && task.deletedAt === null,
    canRestore: recovery && task.deletedAt != null,
    canUnarchive: writer && task.deletedAt === null && task.archivedAt != null,
  };
}

export async function taskCanRead(ctx: QueryCtx, task: Doc<"tasks">, userId: Id<"users">) {
  if (!taskIsReadable(task)) return false;
  const project = await ctx.db.get(task.projectId);
  if (!project || project.archived || project.deletedAt != null || project.workspaceId !== task.workspaceId)
    return false;
  const workspace = await ctx.db
    .query("workspaceMembers")
    .withIndex("by_workspace_user", (q) => q.eq("workspaceId", task.workspaceId).eq("userId", userId))
    .unique();
  const member = await ctx.db
    .query("projectMembers")
    .withIndex("by_project_user", (q) => q.eq("projectId", task.projectId).eq("userId", userId))
    .unique();
  return (
    !!workspace?.active &&
    !!member?.active &&
    taskRoleCanRead(task, userId, workspace.role, member.role, !!project.guestViewAllFeatures)
  );
}

export async function readableTasks(ctx: QueryCtx, tasks: Doc<"tasks">[], userId: Id<"users">) {
  const rows = await Promise.all(tasks.map(async (task) => ((await taskCanRead(ctx, task, userId)) ? task : null)));
  return rows.filter((row) => row !== null);
}
