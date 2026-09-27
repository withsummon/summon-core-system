import { ConvexError } from "convex/values";
import type { QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { requireProject } from "../identity/access";
type IntakeAccess = {
  user: Pick<Doc<"users">, "_id">;
  member: Pick<Doc<"workspaceMembers">, "role">;
  projectMember: Pick<Doc<"projectMembers">, "role">;
  project: Pick<Doc<"projects">, "guestViewAllFeatures">;
};
export function intakeCapabilities(access: IntakeAccess, creator: Id<"users">) {
  const admin = access.projectMember.role === "admin" || access.member.role === "admin";
  const own = access.user._id === creator;
  const guest = access.projectMember.role === "guest" || access.member.role === "guest";
  return {
    canRead: !guest || !!access.project.guestViewAllFeatures || own || admin,
    canEdit: !guest || own || admin,
    canEditProperties: !guest,
    canEditPriority: !guest,
    canDecide: admin,
    canRemove: own || admin,
  };
}
export async function requireIntakeTask(ctx: QueryCtx, taskId: Id<"tasks">, mode: "active" | "removed" = "active") {
  const task = await ctx.db.get(taskId);
  if (!task || (mode === "active" && (task.deletedAt != null || task.archivedAt != null)))
    throw new ConvexError("Intake task not found.");
  const access = await requireProject(ctx, task.projectId);
  const intake = await ctx.db
    .query("intakeTasks")
    .withIndex("by_task", (q) => q.eq("taskId", taskId))
    .unique();
  if (!intake) throw new ConvexError("Intake task not found.");
  const capabilities = intakeCapabilities(access, intake.createdBy);
  const removed = mode === "removed";
  if ((intake.deletedAt != null) !== removed) throw new ConvexError("Intake task not found.");
  if (!(removed ? capabilities.canRemove : capabilities.canRead)) throw new ConvexError("Intake task not found.");
  return { task, intake, access, ...capabilities };
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
