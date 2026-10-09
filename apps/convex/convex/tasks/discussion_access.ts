import { ConvexError } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { intakeCapabilities, requireIntakeTask } from "../intakes/access";
import { requireProject } from "../identity/access";
import { projectReader } from "../savedViews/scope";
import { requireTask, taskCanRead } from "./access";

// Discussion admits active intake submissions without changing ordinary task visibility.
export async function requireDiscussion(ctx: QueryCtx, taskId: Id<"tasks">, mode: "active" | "read" = "active") {
  const task = await ctx.db.get(taskId);
  if (!task) throw new ConvexError("Task not found.");
  if (task.status === "triage") return (await requireIntakeTask(ctx, taskId)).task;
  return requireTask(ctx, taskId, mode);
}
export function discussionIsActive(task: Doc<"tasks">) {
  return task.deletedAt === null && task.archivedAt === null;
}
export async function discussionCanRead(ctx: QueryCtx, task: Doc<"tasks">, userId: Id<"users">) {
  if (task.status !== "triage") return taskCanRead(ctx, task, userId);
  if (!discussionIsActive(task)) return false;
  const access = await projectReader(ctx, task.workspaceId, userId)(task.projectId);
  if (!access) return false;
  const member = await ctx.db
    .query("workspaceMembers")
    .withIndex("by_workspace_user", (q) => q.eq("workspaceId", task.workspaceId).eq("userId", userId))
    .unique();
  if (!member?.active) return false;
  const intake = await ctx.db
    .query("intakeTasks")
    .withIndex("by_task", (q) => q.eq("taskId", task._id))
    .unique();
  return (
    !!intake &&
    intake.deletedAt === null &&
    intakeCapabilities(
      {
        user: { _id: userId },
        member,
        projectMember: access.member,
        project: access.project,
      },
      intake.createdBy
    ).canRead
  );
}

export async function requireCommentAccess(ctx: QueryCtx, taskId: Id<"tasks">) {
  const task = await requireDiscussion(ctx, taskId, "read");
  const permission = await requireProject(ctx, task.projectId);
  const canCreate =
    (permission.member.role !== "guest" && permission.projectMember.role !== "guest") ||
    task.createdBy === permission.user._id ||
    !!permission.project.guestViewAllFeatures;
  const active = discussionIsActive(task);
  return { ...permission, task, canCreate: active && canCreate };
}

export async function requireEditableComment(ctx: QueryCtx, commentId: Id<"taskComments">, deleted = false) {
  const comment = await ctx.db.get(commentId);
  if (!comment) throw new ConvexError("Comment not found.");
  const task = await requireDiscussion(ctx, comment.taskId);
  const permission = await requireProject(ctx, task.projectId);
  if (comment.authorId !== permission.user._id && permission.projectMember.role !== "admin")
    throw new ConvexError("Only the author or a project administrator can change this comment.");
  if ((comment.deletedAt != null) !== deleted)
    throw new ConvexError(deleted ? "Comment is not deleted." : "This comment is deleted. Restore it before editing.");
  return { comment, task, ...permission };
}
