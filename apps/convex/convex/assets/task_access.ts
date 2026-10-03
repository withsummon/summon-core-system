import { ConvexError } from "convex/values";
import type { QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { requireProject } from "../identity/access";
import { requireIntakeTask } from "../intakes/access";
import { requireTask } from "../tasks/access";

// Task scope permits guest uploads (legacy attachment contract), unlike generic workspace asset writes.
// Triage visibility is delegated to intake; acceptance keeps the same task/asset binding.
export async function requireTaskAttachmentAccess(ctx: QueryCtx, taskId: Id<"tasks">, write = false) {
  const candidate = await ctx.db.get(taskId);
  if (!candidate) throw new ConvexError("Task not found.");
  if (candidate.status === "triage") {
    const { task, access } = await requireIntakeTask(ctx, taskId);
    return { ...access, task };
  }
  const task = await requireTask(ctx, taskId, "read");
  const access = await requireProject(ctx, task.projectId);
  if (write && task.archivedAt != null) throw new ConvexError("Archived task attachments are read-only.");
  return { ...access, task };
}
export function canManageAttachment(
  asset: Doc<"assets">,
  permission: Awaited<ReturnType<typeof requireTaskAttachmentAccess>>
) {
  return (
    asset.createdBy === permission.user._id ||
    permission.projectMember.role === "admin" ||
    permission.member.role === "admin"
  );
}
export function attachmentRevision(asset: Doc<"assets">) {
  if (asset.attachmentRevision === undefined) throw new ConvexError("Task attachment revision is missing.");
  return asset.attachmentRevision;
}
