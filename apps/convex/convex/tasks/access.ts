import { ConvexError } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { requireProject } from "../identity/access";
import { personalImageDescriptor, userAppearance } from "../identity/avatar_owner";
export function taskIsActive(task: Doc<"tasks">) {
  return task.status !== "triage" && task.deletedAt === null && task.archivedAt === null;
}
export function taskIsReadable(task: Doc<"tasks">) {
  return task.status !== "triage" && task.deletedAt === null;
}
export function taskRoleCanReadAll(
  workspaceRole: Doc<"workspaceMembers">["role"],
  projectRole: Doc<"projectMembers">["role"],
  guestViewAllFeatures: boolean
) {
  return (workspaceRole !== "guest" && projectRole !== "guest") || guestViewAllFeatures;
}
export function taskRoleCanRead(
  task: Pick<Doc<"tasks">, "createdBy">,
  userId: Id<"users">,
  workspaceRole: Doc<"workspaceMembers">["role"],
  projectRole: Doc<"projectMembers">["role"],
  guestViewAllFeatures: boolean
) {
  return taskRoleCanReadAll(workspaceRole, projectRole, guestViewAllFeatures) || task.createdBy === userId;
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
  const { user, member, projectMember, project } = await requireProject(ctx, task.projectId);
  const writer = member.role !== "guest" && projectMember.role !== "guest";
  const recovery = task.createdBy === user._id || projectMember.role === "admin";
  const [creator, creatorMembership] = await Promise.all([
    ctx.db.get(task.createdBy),
    ctx.db
      .query("workspaceMembers")
      .withIndex("by_workspace_user", (q) => q.eq("workspaceId", project.workspaceId).eq("userId", task.createdBy))
      .unique(),
  ]);
  const assignees = await Promise.all(
    task.assigneeIds.map(async (id) => {
      const [person, projectMembership, workspaceMembership] = await Promise.all([
        ctx.db.get(id),
        ctx.db
          .query("projectMembers")
          .withIndex("by_project_user", (q) => q.eq("projectId", project._id).eq("userId", id))
          .unique(),
        ctx.db
          .query("workspaceMembers")
          .withIndex("by_workspace_user", (q) => q.eq("workspaceId", project.workspaceId).eq("userId", id))
          .unique(),
      ]);
      const selectable = Boolean(
        person &&
        projectMembership?.active &&
        projectMembership.role !== "guest" &&
        workspaceMembership?.active &&
        workspaceMembership.role !== "guest"
      );
      return {
        id,
        name: person?.name ?? null,
        email: selectable ? (person?.email ?? null) : null,
        avatar:
          person && workspaceMembership?.active
            ? await personalImageDescriptor(ctx, await userAppearance(ctx, id), "avatar", project.workspaceId)
            : null,
        selectable,
      };
    })
  );
  return {
    ...task,
    creator: {
      name: creator?.name ?? null,
      avatar:
        creator && creatorMembership?.active
          ? await personalImageDescriptor(ctx, await userAppearance(ctx, task.createdBy), "avatar", project.workspaceId)
          : null,
    },
    assignees,
    archivedAt: task.archivedAt ?? null,
    deletedAt: task.deletedAt ?? null,
    canEdit: writer && taskIsActive(task),
    canArchive: writer && taskIsActive(task) && (task.status === "done" || task.status === "cancelled"),
    canDelete: recovery && task.deletedAt === null,
    canRestore: recovery && task.deletedAt != null,
    canUnarchive: writer && task.deletedAt === null && task.archivedAt != null,
  };
}

export async function taskCanRead(
  ctx: QueryCtx,
  task: Doc<"tasks">,
  userId: Id<"users">,
  mode: "read" | "recovery" = "read"
) {
  if (task.status === "triage" || (mode === "read" && !taskIsReadable(task))) return false;
  const project = await ctx.db.get(task.projectId);
  if (!project || project.archived || project.deletedAt != null || project.workspaceId !== task.workspaceId)
    return false;
  const ancestor = await ctx.db.get(task.workspaceId);
  if (!ancestor || ancestor.deletedAt != null) return false;
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
    (mode === "recovery"
      ? task.createdBy === userId || member.role === "admin"
      : taskRoleCanRead(task, userId, workspace.role, member.role, !!project.guestViewAllFeatures))
  );
}

export async function readableTasks(ctx: QueryCtx, tasks: Doc<"tasks">[], userId: Id<"users">) {
  const rows = await Promise.all(tasks.map(async (task) => ((await taskCanRead(ctx, task, userId)) ? task : null)));
  return rows.filter((row) => row !== null);
}
