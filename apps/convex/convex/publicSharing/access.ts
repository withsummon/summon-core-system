import { ConvexError, v, type Infer } from "convex/values";
import type { QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { taskIsActive } from "../tasks/access";
import { status } from "../tasks/schema";
import { uploadedImageSources } from "../tasks/rich_content";
import { projectAppearance } from "../projects/cover_owner";
import { personalImageDescriptor, userAppearance } from "../identity/avatar_owner";
import { accountRestricted } from "../identity/deactivation/access";
import { profileIdentity } from "../identity/profile_owner";

export const publicImageTarget = v.union(
  v.object({ kind: v.literal("cover") }),
  v.object({ kind: v.literal("description"), taskId: v.string() }),
  v.object({ kind: v.literal("comment"), taskId: v.string(), commentId: v.string() }),
  v.object({ kind: v.literal("commentAvatar"), taskId: v.string(), commentId: v.string() })
);

export function publicationForProject(ctx: QueryCtx, projectId: Id<"projects">) {
  return ctx.db
    .query("projectPublications")
    .withIndex("by_project", (q) => q.eq("projectId", projectId))
    .unique();
}

// Anonymous access is owned by the current publication, never by project membership.
// Every query reads this row and its ancestors so revoke/archive/delete invalidates subscriptions.
export async function requirePublishedProject(ctx: QueryCtx, anchor: string) {
  const publication = await ctx.db
    .query("projectPublications")
    .withIndex("by_anchor", (q) => q.eq("anchor", anchor))
    .unique();
  if (!publication || publication.revokedAt !== null) throw new ConvexError("Project is not published.");
  const project = await ctx.db.get(publication.projectId);
  if (!project || project.archived || project.deletedAt != null) throw new ConvexError("Project is not published.");
  const workspace = await ctx.db.get(project.workspaceId);
  if (!workspace || workspace.deletedAt != null) throw new ConvexError("Project is not published.");
  return { publication, project, workspace };
}

export function publishedTask(
  task: Doc<"tasks">,
  { project }: Awaited<ReturnType<typeof requirePublishedProject>>
): task is Doc<"tasks"> & { status: Infer<typeof status> } {
  return taskIsActive(task) && task.projectId === project._id && task.workspaceId === project.workspaceId;
}

export async function requirePublishedTask(ctx: QueryCtx, anchor: string, taskId: Id<"tasks">) {
  const access = await requirePublishedProject(ctx, anchor);
  const task = await ctx.db.get(taskId);
  if (!task || !publishedTask(task, access)) throw new ConvexError("Work item is not published.");
  return { ...access, task };
}

export function requirePublishedReactions(access: Awaited<ReturnType<typeof requirePublishedTask>>) {
  if (!access.publication.settings.reactionsEnabled) throw new ConvexError("Public reactions are disabled.");
}

export async function requirePublishedDiscussion(ctx: QueryCtx, anchor: string, taskId: Id<"tasks">) {
  const access = await requirePublishedTask(ctx, anchor, taskId);
  if (!access.publication.settings.commentsEnabled) throw new ConvexError("Public comments are disabled.");
  return access;
}

export async function requirePublishedComment(
  ctx: QueryCtx,
  anchor: string,
  taskId: Id<"tasks">,
  commentId: Id<"taskComments">
) {
  const access = await requirePublishedDiscussion(ctx, anchor, taskId);
  const comment = await ctx.db.get(commentId);
  if (!comment || comment.taskId !== taskId || comment.audience !== "EXTERNAL" || comment.deletedAt != null)
    throw new ConvexError("Comment not found.");
  return { ...access, comment };
}

export async function requirePublishedCover(ctx: QueryCtx, anchor: string, rawAssetId: string) {
  const { project } = await requirePublishedProject(ctx, anchor);
  const appearance = await projectAppearance(ctx, project._id);
  const assetId = ctx.db.normalizeId("assets", rawAssetId);
  const asset = assetId ? await ctx.db.get(assetId) : null;
  if (
    !asset ||
    appearance?.coverAssetId !== asset._id ||
    asset.purpose !== "projectCover" ||
    asset.status !== "ready" ||
    !asset.storageId ||
    !asset.contentType.startsWith("image/") ||
    asset.workspaceId !== project.workspaceId ||
    asset.projectId !== project._id ||
    asset.documentId !== null ||
    [
      asset.taskId,
      asset.draftId,
      asset.commentUpload,
      asset.commentId,
      asset.conversationId,
      asset.meetingId,
      asset.automationJobId,
      asset.exportJobId,
      asset.documentCopyId,
      asset.avatarUserId,
      asset.avatarRevision,
      asset.avatarPublishedRevision,
      asset.projectCoverFormRevision,
      asset.workspaceLogoRevision,
      asset.workspaceLogoPublishedRevision,
    ].some((value) => value !== undefined)
  )
    throw new ConvexError("Project cover is not published.");
  if (!(await ctx.db.system.get(asset.storageId))) throw new ConvexError("Published image bytes are missing.");
  return asset;
}

export async function requirePublishedCommentAvatar(
  ctx: QueryCtx,
  anchor: string,
  taskId: Id<"tasks">,
  commentId: Id<"taskComments">,
  rawAssetId: string
) {
  const { comment } = await requirePublishedComment(ctx, anchor, taskId, commentId);
  if ((await accountRestricted(ctx, comment.authorId)) || !(await profileIdentity(ctx, comment.authorId)))
    throw new ConvexError("Comment author avatar is not published.");
  const appearance = await userAppearance(ctx, comment.authorId);
  const image = await personalImageDescriptor(ctx, appearance, "avatar");
  const assetId = ctx.db.normalizeId("assets", rawAssetId);
  const asset = assetId ? await ctx.db.get(assetId) : null;
  if (
    !asset ||
    image?.id !== asset._id ||
    !asset.storageId ||
    !asset.contentType.startsWith("image/") ||
    asset.workspaceId !== null ||
    asset.projectId !== null ||
    asset.documentId !== null ||
    [
      asset.taskId,
      asset.draftId,
      asset.commentUpload,
      asset.commentId,
      asset.conversationId,
      asset.meetingId,
      asset.automationJobId,
      asset.exportJobId,
      asset.documentCopyId,
      asset.projectCoverRevision,
      asset.projectCoverFormRevision,
      asset.workspaceLogoRevision,
      asset.workspaceLogoPublishedRevision,
    ].some((value) => value !== undefined)
  )
    throw new ConvexError("Comment author avatar is not published.");
  if (!(await ctx.db.system.get(asset.storageId))) throw new ConvexError("Published image bytes are missing.");
  return asset;
}

// Publication authority applies only to an image still referenced by this task's current description.
export async function requirePublishedDescriptionImage(
  ctx: QueryCtx,
  anchor: string,
  taskId: Id<"tasks">,
  rawAssetId: string
) {
  const { task } = await requirePublishedTask(ctx, anchor, taskId);
  const description = await ctx.db
    .query("taskDescriptions")
    .withIndex("by_task", (q) => q.eq("taskId", task._id))
    .unique();
  const assetId = ctx.db.normalizeId("assets", rawAssetId);
  const asset = assetId ? await ctx.db.get(assetId) : null;
  if (
    !description ||
    !asset ||
    asset.status !== "ready" ||
    !asset.storageId ||
    !asset.contentType.startsWith("image/") ||
    asset.taskId !== task._id ||
    asset.projectId !== task.projectId ||
    asset.workspaceId !== task.workspaceId ||
    asset.documentId !== null ||
    [
      asset.draftId,
      asset.commentUpload,
      asset.commentId,
      asset.conversationId,
      asset.meetingId,
      asset.automationJobId,
      asset.exportJobId,
      asset.documentCopyId,
      asset.purpose,
      asset.avatarUserId,
      asset.projectCoverRevision,
      asset.projectCoverFormRevision,
      asset.workspaceLogoRevision,
      asset.workspaceLogoPublishedRevision,
      asset.avatarRevision,
      asset.avatarPublishedRevision,
    ].some((value) => value !== undefined) ||
    !uploadedImageSources(description.html).has(asset._id)
  )
    throw new ConvexError("Image is not published in this work item description.");
  if (!(await ctx.db.system.get(asset.storageId))) throw new ConvexError("Published image bytes are missing.");
  return asset;
}
