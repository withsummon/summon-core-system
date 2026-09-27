import { validateMentions } from "../notifications/mentions";
import { paginationOptsValidator } from "convex/server";
import { ConvexError, v } from "convex/values";
import { mutation, query } from "../_generated/server";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { requireProject } from "../identity/access";
import { recordTaskEvent } from "../notifications/delivery";
import { requireTask, taskIsActive } from "./access";
import { taskRichContent } from "./rich_content";

async function commentAccess(ctx: QueryCtx, taskId: Id<"tasks">) {
  const task = await requireTask(ctx, taskId, "read");
  const permission = await requireProject(ctx, task.projectId);
  const canCreate =
    (permission.member.role !== "guest" && permission.projectMember.role !== "guest") ||
    task.createdBy === permission.user._id ||
    !!permission.project.guestViewAllFeatures;
  const active = taskIsActive(task);
  return { ...permission, task, canCreate: active && canCreate };
}
export const access = query({
  args: { taskId: v.id("tasks") },
  handler: async (ctx, args) => {
    const { canCreate } = await commentAccess(ctx, args.taskId);
    return { canCreate };
  },
});
function commentContent(html: string) {
  const content = taskRichContent(html);
  if (!content.description.trim()) throw new ConvexError("Write a comment before posting.");
  return { html: content.html, text: content.description };
}
async function editableComment(
  ctx: MutationCtx,
  commentId: Id<"taskComments">,
  expectedUpdatedAt: number,
  deleted = false
) {
  const comment = await ctx.db.get(commentId);
  if (!comment) throw new ConvexError("Comment not found.");
  const task = await requireTask(ctx, comment.taskId);
  const permission = await requireProject(ctx, task.projectId);
  if (comment.authorId !== permission.user._id && permission.projectMember.role !== "admin")
    throw new ConvexError("Only the author or a project administrator can change this comment.");
  if ((comment.deletedAt != null) !== deleted)
    throw new ConvexError(deleted ? "Comment is not deleted." : "This comment is deleted. Restore it before editing.");
  if (!Number.isSafeInteger(expectedUpdatedAt) || comment.updatedAt !== expectedUpdatedAt)
    throw new ConvexError("This comment changed. Reload before editing.");
  return { comment, task, ...permission };
}
export const list = query({
  args: {
    taskId: v.id("tasks"),
    deleted: v.optional(v.boolean()),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const permission = await commentAccess(ctx, args.taskId);
    const { task } = permission;
    if (
      !Number.isSafeInteger(args.paginationOpts.numItems) ||
      args.paginationOpts.numItems < 1 ||
      args.paginationOpts.numItems > 50
    )
      throw new ConvexError("Request 1 to 50 comments per page.");
    const result = await ctx.db
      .query("taskComments")
      .withIndex("by_task", (q) => q.eq("taskId", task._id))
      .order("desc")
      .paginate({ ...args.paginationOpts, maximumRowsRead: 50, maximumBytesRead: 1_048_576 });
    const page = await Promise.all(
      result.page
        .filter(
          (comment) =>
            (comment.deletedAt != null) === (args.deleted ?? false) &&
            (!args.deleted || comment.authorId === permission.user._id || permission.projectMember.role === "admin")
        )
        // oxlint-disable-next-line no-map-spread -- Enrich immutable database rows without mutating the stored record.
        .map(async (comment) => {
          const author = await ctx.db.get(comment.authorId);
          return {
            ...comment,
            authorName: author?.name ?? null,
            canEdit:
              taskIsActive(task) &&
              comment.deletedAt == null &&
              (comment.authorId === permission.user._id || permission.projectMember.role === "admin"),
            canRestore:
              taskIsActive(task) &&
              comment.deletedAt != null &&
              (comment.authorId === permission.user._id || permission.projectMember.role === "admin"),
          };
        })
    );
    return {
      ...result,
      page,
      canCreate: permission.canCreate,
    };
  },
});
export const create = mutation({
  args: { taskId: v.id("tasks"), html: v.string(), mentionedUserIds: v.optional(v.array(v.id("users"))) },
  handler: async (ctx, args) => {
    const { task, user, canCreate } = await commentAccess(ctx, args.taskId);
    if (!canCreate) throw new ConvexError("Guests can comment only on tasks they created.");
    const mentionedUserIds = await validateMentions(ctx, task, args.mentionedUserIds ?? []);
    const content = commentContent(args.html);
    const commentId = await ctx.db.insert("taskComments", {
      taskId: task._id,
      authorId: user._id,
      mentionedUserIds,
      ...content,
      updatedAt: Date.now(),
      editedAt: null,
      deletedAt: null,
    });
    await recordTaskEvent(
      ctx,
      {
        workspaceId: task.workspaceId,
        projectId: task.projectId,
        taskId: task._id,
        actorId: user._id,
        kind: "comment_created",
        status: task.status,
        commentId,
      },
      mentionedUserIds
    );
    return commentId;
  },
});
export const update = mutation({
  args: {
    commentId: v.id("taskComments"),
    expectedUpdatedAt: v.number(),
    html: v.string(),
    mentionedUserIds: v.optional(v.array(v.id("users"))),
  },
  handler: async (ctx, args) => {
    const { comment, task, user } = await editableComment(ctx, args.commentId, args.expectedUpdatedAt);
    const content = commentContent(args.html);
    const mentionedUserIds = await validateMentions(ctx, task, args.mentionedUserIds ?? comment.mentionedUserIds ?? []);
    const previousMentions = comment.mentionedUserIds ?? [];
    if (
      content.html === comment.html &&
      mentionedUserIds.length === previousMentions.length &&
      mentionedUserIds.every((id) => previousMentions.includes(id))
    )
      return comment._id;
    const updatedAt = Math.max(Date.now(), comment.updatedAt + 1);
    await ctx.db.patch(comment._id, { ...content, mentionedUserIds, updatedAt, editedAt: updatedAt });
    await recordTaskEvent(
      ctx,
      {
        workspaceId: task.workspaceId,
        projectId: task.projectId,
        taskId: task._id,
        actorId: user._id,
        kind: "comment_updated",
        status: task.status,
        commentId: comment._id,
      },
      mentionedUserIds.filter((id) => !previousMentions.includes(id))
    );
    return comment._id;
  },
});
export const remove = mutation({
  args: { commentId: v.id("taskComments"), expectedUpdatedAt: v.number() },
  handler: async (ctx, args) => {
    const { comment, task, user } = await editableComment(ctx, args.commentId, args.expectedUpdatedAt);
    const updatedAt = Math.max(Date.now(), comment.updatedAt + 1);
    await ctx.db.patch(comment._id, { deletedAt: updatedAt, updatedAt });
    await recordTaskEvent(ctx, {
      workspaceId: task.workspaceId,
      projectId: task.projectId,
      taskId: task._id,
      actorId: user._id,
      kind: "comment_deleted",
      status: task.status,
      commentId: comment._id,
    });
  },
});

export const restore = mutation({
  args: { commentId: v.id("taskComments"), expectedUpdatedAt: v.number() },
  handler: async (ctx, args) => {
    const { comment, task, user } = await editableComment(ctx, args.commentId, args.expectedUpdatedAt, true);
    await ctx.db.patch(comment._id, {
      deletedAt: null,
      updatedAt: Math.max(Date.now(), comment.updatedAt + 1),
    });
    await recordTaskEvent(ctx, {
      workspaceId: task.workspaceId,
      projectId: task.projectId,
      taskId: task._id,
      actorId: user._id,
      kind: "comment_restored",
      status: task.status,
      commentId: comment._id,
    });
    return comment._id;
  },
});

// Notification links resolve a canonical comment even when its chronological page is not loaded.
export const get = query({
  args: { taskId: v.id("tasks"), commentId: v.string() },
  handler: async (ctx, args) => {
    await commentAccess(ctx, args.taskId);
    const id = ctx.db.normalizeId("taskComments", args.commentId);
    const comment = id ? await ctx.db.get(id) : null;
    if (!comment || comment.taskId !== args.taskId || comment.deletedAt != null)
      throw new ConvexError("Comment not found.");
    const author = await ctx.db.get(comment.authorId);
    return { ...comment, mentionedUserIds: comment.mentionedUserIds ?? [], authorName: author?.name ?? null };
  },
});
