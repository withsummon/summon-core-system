import { compareValues, ConvexError, type Infer } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { requireUser } from "../identity/access";
import { requirePublishedComment, requirePublishedDiscussion } from "../publicSharing/access";
import { requireCommentAccess, requireEditableComment } from "../tasks/discussion_access";
import { imageRichContent, uploadedImageSources } from "../tasks/rich_content";
import { commentRequestId } from "../tasks/schema";
import type { commentImageTarget } from "./schema";
import type { requireAssetScope } from "./access";

export async function requireCommentImageTarget(ctx: QueryCtx, target: Infer<typeof commentImageTarget>) {
  if ("requestId" in target) {
    const requestId = commentRequestId.safeParse(target.requestId);
    if (!requestId.success) throw new ConvexError("Provide a UUID for this comment creation request.");
    target = { ...target, requestId: requestId.data };
  }
  if (target.anchor !== null) {
    const user = await requireUser(ctx);
    if ("commentId" in target) {
      const { task, comment } = await requirePublishedComment(ctx, target.anchor, target.taskId, target.commentId);
      if (comment.authorId !== user._id) throw new ConvexError("Only the author can change this public comment.");
      return { user, task, target };
    }
    return { user, task: (await requirePublishedDiscussion(ctx, target.anchor, target.taskId)).task, target };
  }
  if ("commentId" in target) {
    const permission = await requireEditableComment(ctx, target.commentId);
    if (permission.task._id !== target.taskId) throw new ConvexError("Comment belongs to another work item.");
    return { user: permission.user, task: permission.task, target };
  }
  const permission = await requireCommentAccess(ctx, target.taskId);
  if (!permission.canCreate) throw new ConvexError("Guests can comment only on tasks they created.");
  return { user: permission.user, task: permission.task, target };
}

function requireCommentOnlyScope(scope: Parameters<typeof requireAssetScope>[1]) {
  if (
    [
      scope.taskId,
      scope.draftId,
      scope.documentId,
      scope.documentCopyId,
      scope.conversationId,
      scope.meetingId,
      scope.automationJobId,
      scope.purpose,
      scope.avatarUserId,
    ].some(Boolean) ||
    (scope.commentId !== undefined && scope.commentUpload !== undefined)
  )
    throw new ConvexError("Comment images cannot have another content scope.");
}

// Pending bytes belong to their uploader and exact composer; adoption transfers authority to the comment.
export async function requireCommentImageScope(
  ctx: QueryCtx,
  scope: Parameters<typeof requireAssetScope>[1],
  write: boolean
) {
  requireCommentOnlyScope(scope);
  if (scope.commentUpload) {
    const permission = await requireCommentImageTarget(ctx, scope.commentUpload);
    if (scope.createdBy !== undefined && scope.createdBy !== permission.user._id)
      throw new ConvexError("Comment upload belongs to another account.");
    if (scope.expiresAt !== undefined && scope.expiresAt <= Date.now())
      throw new ConvexError("Comment upload has expired.");
    if (scope.workspaceId !== permission.task.workspaceId || scope.projectId !== permission.task.projectId)
      throw new ConvexError("Comment image scope mismatch.");
    return permission;
  }
  if (!scope.commentId) throw new ConvexError("Comment image has no comment.");
  const comment = await ctx.db.get(scope.commentId);
  if (!comment) throw new ConvexError("Comment not found.");
  const permission = write
    ? await requireEditableComment(ctx, comment._id, comment.deletedAt != null)
    : await requireCommentAccess(ctx, comment.taskId);
  if (
    comment.deletedAt != null &&
    comment.authorId !== permission.user._id &&
    permission.projectMember.role !== "admin"
  )
    throw new ConvexError("Deleted comment is private to its author and project administrators.");
  if (scope.workspaceId !== permission.task.workspaceId || scope.projectId !== permission.task.projectId)
    throw new ConvexError("Comment image scope mismatch.");
  return { user: permission.user, task: permission.task };
}

export async function bindCommentImages(
  ctx: MutationCtx,
  target: Infer<typeof commentImageTarget>,
  parsed: ReturnType<typeof imageRichContent>,
  commentId: Id<"taskComments">
) {
  const { user, task, target: canonicalTarget } = await requireCommentImageTarget(ctx, target);
  const { sources, ...content } = parsed;
  if (!content.description && sources.size === 0) throw new ConvexError("Write a comment before posting.");
  await Promise.all(
    [...sources].map(async (source) => {
      const id = ctx.db.normalizeId("assets", source);
      const asset = id ? await ctx.db.get(id) : null;
      if (!asset || asset.status !== "ready" || !asset.storageId || !asset.contentType.startsWith("image/"))
        throw new ConvexError("Comment image is not ready.");
      requireCommentOnlyScope(asset);
      if (asset.workspaceId !== task.workspaceId || asset.projectId !== task.projectId)
        throw new ConvexError("Comment image belongs to another work item.");
      if (!(await ctx.db.system.get(asset.storageId))) throw new ConvexError("Comment image bytes are missing.");
      if (asset.commentUpload) {
        if (
          asset.createdBy !== user._id ||
          compareValues(asset.commentUpload, canonicalTarget) !== 0 ||
          asset.expiresAt <= Date.now()
        )
          throw new ConvexError("Comment image belongs to another composer or has expired.");
        await ctx.db.patch(asset._id, { commentUpload: undefined, commentId });
      } else if (asset.commentId !== commentId) {
        throw new ConvexError("Comment image belongs to another comment.");
      }
    })
  );
  return { html: content.html, text: content.description };
}

export async function requirePublicCommentImage(
  ctx: QueryCtx,
  anchor: string,
  taskId: Id<"tasks">,
  commentId: Id<"taskComments">,
  asset: Doc<"assets">
) {
  requireCommentOnlyScope(asset);
  const { task, comment } = await requirePublishedComment(ctx, anchor, taskId, commentId);
  if (
    asset.status !== "ready" ||
    asset.commentId !== comment._id ||
    asset.commentUpload ||
    !asset.storageId ||
    asset.workspaceId !== task.workspaceId ||
    asset.projectId !== task.projectId ||
    !asset.contentType.startsWith("image/") ||
    !uploadedImageSources(comment.html).has(asset._id)
  )
    throw new ConvexError("Image is not published in this comment.");
  return asset;
}
