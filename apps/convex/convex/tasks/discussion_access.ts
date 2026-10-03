import { ConvexError } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { intakeCapabilities, requireIntakeTask } from "../intakes/access";
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
