import { ConvexError } from "convex/values";
import type { QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { requireProject, requireProjectMembershipForUser } from "../identity/access";
import { requireAccountUser } from "../identity/session";
import { requireIntakeTask } from "../intakes/access";
import { requireTask } from "../tasks/access";

// Public Task lookup and PATCH retain nontrashed rows, including archived Tasks and Projects.
// Any active project member may read their images, including Guests.
// The browser attachment owner below keeps its separate own-task/intake policy.
export async function requireApiTaskAttachmentAccess(ctx: QueryCtx, userId: Id<"users">, taskId: Id<"tasks">) {
  const user = await requireAccountUser(ctx, userId);
  const task = await ctx.db.get(taskId);
  if (!task || task.deletedAt !== null) throw new ConvexError("Task not found.");
  const project = await ctx.db.get(task.projectId);
  if (!project) throw new ConvexError("Project not found.");
  const access = await requireProjectMembershipForUser(ctx, project, user, false);
  if (task.workspaceId !== access.workspace._id) throw new ConvexError("Task belongs to another workspace.");
  return { ...access, task };
}

export function requireTaskImageAsset(asset: Doc<"assets">, task: Doc<"tasks">) {
  if (
    asset.status !== "ready" ||
    asset.taskId !== task._id ||
    asset.workspaceId !== task.workspaceId ||
    asset.projectId !== task.projectId ||
    !asset.contentType.startsWith("image/") ||
    asset.projectCoverFormRevision !== undefined ||
    [
      asset.purpose,
      asset.documentId,
      asset.documentCopyId,
      asset.draftId,
      asset.commentId,
      asset.commentUpload,
      asset.conversationId,
      asset.meetingId,
      asset.automationJobId,
      asset.exportJobId,
      asset.avatarUserId,
    ].some((value) => value !== undefined && value !== null)
  )
    throw new ConvexError("Description image scope does not match this work item.");
  return asset;
}

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
