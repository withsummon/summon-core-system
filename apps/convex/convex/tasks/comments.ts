import { paginationOptsValidator } from "convex/server";
import { ConvexError, v } from "convex/values";
import { mutation, query } from "../_generated/server";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { requireProject } from "../identity/access";
import { recordTaskEvent } from "../notifications/delivery";
import { requireTask } from "./properties";
import { taskRichContent } from "./rich_content";

async function commentAccess(ctx: QueryCtx, taskId: Id<"tasks">) {
  const task = await requireTask(ctx, taskId);
  const permission = await requireProject(ctx, task.projectId);
  const canCreate =
    (permission.member.role !== "guest" && permission.projectMember.role !== "guest") ||
    task.createdBy === permission.user._id;
  return { ...permission, task, canCreate };
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
async function editableComment(ctx: MutationCtx, commentId: Id<"taskComments">, expectedUpdatedAt: number) {
  const comment = await ctx.db.get(commentId);
  if (!comment) throw new ConvexError("Comment not found.");
  const task = await requireTask(ctx, comment.taskId);
  const permission = await requireProject(ctx, task.projectId);
  if (comment.authorId !== permission.user._id && permission.projectMember.role !== "admin")
    throw new ConvexError("Only the author or a project administrator can change this comment.");
  if (!Number.isSafeInteger(expectedUpdatedAt) || comment.updatedAt !== expectedUpdatedAt)
    throw new ConvexError("This comment changed. Reload before editing.");
  return { comment, task, ...permission };
}
export const list = query({
  args: { taskId: v.id("tasks"), paginationOpts: paginationOptsValidator },
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
      result.page.map(async (comment) => {
        const author = await ctx.db.get(comment.authorId);
        return {
          ...comment,
          authorName: author?.name ?? null,
          canEdit: comment.authorId === permission.user._id || permission.projectMember.role === "admin",
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
  args: { taskId: v.id("tasks"), html: v.string() },
  handler: async (ctx, args) => {
    const { task, user, canCreate } = await commentAccess(ctx, args.taskId);
    if (!canCreate) throw new ConvexError("Guests can comment only on tasks they created.");
    const content = commentContent(args.html);
    const commentId = await ctx.db.insert("taskComments", {
      taskId: task._id,
      authorId: user._id,
      ...content,
      updatedAt: Date.now(),
      editedAt: null,
    });
    await recordTaskEvent(ctx, {
      workspaceId: task.workspaceId,
      projectId: task.projectId,
      taskId: task._id,
      actorId: user._id,
      kind: "comment_created",
      status: task.status,
      commentId,
    });
    return commentId;
  },
});
export const update = mutation({
  args: { commentId: v.id("taskComments"), expectedUpdatedAt: v.number(), html: v.string() },
  handler: async (ctx, args) => {
    const { comment, task, user } = await editableComment(ctx, args.commentId, args.expectedUpdatedAt);
    const content = commentContent(args.html);
    if (content.html === comment.html) return comment._id;
    const updatedAt = Math.max(Date.now(), comment.updatedAt + 1);
    await ctx.db.patch(comment._id, { ...content, updatedAt, editedAt: updatedAt });
    await recordTaskEvent(ctx, {
      workspaceId: task.workspaceId,
      projectId: task.projectId,
      taskId: task._id,
      actorId: user._id,
      kind: "comment_updated",
      status: task.status,
      commentId: comment._id,
    });
    return comment._id;
  },
});
export const remove = mutation({
  args: { commentId: v.id("taskComments"), expectedUpdatedAt: v.number() },
  handler: async (ctx, args) => {
    const { comment, task, user } = await editableComment(ctx, args.commentId, args.expectedUpdatedAt);
    await ctx.db.delete(comment._id);
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
