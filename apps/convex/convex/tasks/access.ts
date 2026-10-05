import { ConvexError, type Infer } from "convex/values";
import type { DataModel, Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { requireProject } from "../identity/access";
import { memberIdentity } from "../projects/directory";
import { personalImageDescriptor, userAppearance } from "../identity/avatar_owner";
import { taskOrder } from "./schema";
import { currentTaskCycle } from "../cycles/tasks";
import { currentTaskModules } from "../modules/tasks";
export const taskOrdering = {
  sortOrder: { index: "by_workspace_manual", direction: "asc" },
  createdAt: { index: "by_workspace", direction: "desc" },
  updatedAt: { index: "by_workspace_updated", direction: "desc" },
  startDate: { index: "by_workspace_start_date", direction: "asc" },
  targetDate: { index: "by_workspace_target_date", direction: "asc" },
  priority: { index: "by_workspace_priority", direction: "asc" },
} satisfies Record<Infer<typeof taskOrder>, { index: keyof DataModel["tasks"]["indexes"]; direction: "asc" | "desc" }>;
export function taskIsActive(
  task: Doc<"tasks">
): task is Doc<"tasks"> & { status: Exclude<Doc<"tasks">["status"], "triage"> } {
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

export async function taskAssignee(
  ctx: QueryCtx,
  project: Pick<Doc<"projects">, "_id" | "workspaceId">,
  id: Id<"users">,
  viewerWorkspaceRole: Doc<"workspaceMembers">["role"]
) {
  const [identity, projectMembership] = await Promise.all([
    memberIdentity(ctx, project.workspaceId, viewerWorkspaceRole, id, ""),
    ctx.db
      .query("projectMembers")
      .withIndex("by_project_user", (q) => q.eq("projectId", project._id).eq("userId", id))
      .unique(),
  ]);
  const selectable = Boolean(
    identity && projectMembership?.active && projectMembership.role !== "guest" && identity.workspaceRole !== "guest"
  );
  return {
    id,
    name: identity ? identity.fullName || identity.displayName : null,
    email: identity && selectable ? identity.email : null,
    avatar: identity?.avatar ?? null,
    selectable,
  };
}

export async function taskDetail(
  ctx: QueryCtx,
  task: Awaited<ReturnType<typeof requireTask>>,
  { user, member, projectMember, project }: Awaited<ReturnType<typeof requireProject>>
) {
  if (
    task.projectId !== project._id ||
    task.workspaceId !== project.workspaceId ||
    !taskRoleCanRead(task, user._id, member.role, projectMember.role, !!project.guestViewAllFeatures)
  )
    throw new ConvexError("Task not found.");
  const writer = member.role !== "guest" && projectMember.role !== "guest";
  const recovery = task.createdBy === user._id || projectMember.role === "admin";
  const [creator, creatorMembership] = await Promise.all([
    ctx.db.get(task.createdBy),
    ctx.db
      .query("workspaceMembers")
      .withIndex("by_workspace_user", (q) => q.eq("workspaceId", project.workspaceId).eq("userId", task.createdBy))
      .unique(),
  ]);
  const [assignees, cycle, modules] = await Promise.all([
    Promise.all(task.assigneeIds.map((id) => taskAssignee(ctx, project, id, member.role))),
    currentTaskCycle(ctx, task),
    currentTaskModules(ctx, task),
  ]);
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
    cycle: cycle.cycle,
    cycleReference: cycle.reference,
    modules: modules.modules,
    moduleReferences: modules.references,
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
