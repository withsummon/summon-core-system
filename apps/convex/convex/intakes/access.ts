import { ConvexError } from "convex/values";
import type { QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { requireProject } from "../identity/access";
export function intakeCapabilities(access: Awaited<ReturnType<typeof requireProject>>, creator: Id<"users">) {
  const admin = access.projectMember.role === "admin" || access.member.role === "admin";
  const own = access.user._id === creator;
  const guest = access.projectMember.role === "guest" || access.member.role === "guest";
  return {
    canRead: !guest || !!access.project.guestViewAllFeatures || own || admin,
    canEdit: own || admin,
    canEditPriority: (own || admin) && !guest,
    canDecide: admin,
    canRemove: own || admin,
  };
}
export async function requireIntakeTask(ctx: QueryCtx, taskId: Id<"tasks">) {
  const task = await ctx.db.get(taskId);
  if (!task || task.deletedAt != null || task.archivedAt != null) throw new ConvexError("Intake task not found.");
  const access = await requireProject(ctx, task.projectId);
  const intake = await ctx.db
    .query("intakeTasks")
    .withIndex("by_task", (q) => q.eq("taskId", taskId))
    .unique();
  if (!intake || intake.deletedAt != null || !intakeCapabilities(access, intake.createdBy).canRead)
    throw new ConvexError("Intake task not found.");
  return { task, intake, access, ...intakeCapabilities(access, intake.createdBy) };
}
export function requireIntakeRevision(
  intake: Doc<"intakeTasks">,
  task: Doc<"tasks">,
  expectedUpdatedAt: number,
  expectedTaskUpdatedAt: number
) {
  if (intake.updatedAt !== expectedUpdatedAt || task.updatedAt !== expectedTaskUpdatedAt)
    throw new ConvexError("This intake task changed. Refresh before saving.");
}
