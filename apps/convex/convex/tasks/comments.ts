import { validateMentions } from "../notifications/mentions";
import { paginationOptsValidator } from "convex/server";
import { stream } from "convex-helpers/server/stream";
import { ConvexError, v } from "convex/values";
import { mutation, query } from "../_generated/server";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { requireProject, requireUser } from "../identity/access";
import { recordTaskEvent } from "../notifications/delivery";
import { pageBudget } from "../commercial/validation";
import { requirePublishedComment, requirePublishedDiscussion } from "../publicSharing/access";
import schema from "../schema";
import { requireDiscussion, discussionIsActive } from "./discussion_access";
import { taskRichContent } from "./rich_content";
import { commentAudience } from "./schema";

const revisionFields = { commentId: v.id("taskComments"), expectedUpdatedAt: v.number() };
const publicTarget = { anchor: v.string(), taskId: v.id("tasks") };
async function commentAccess(ctx: QueryCtx, taskId: Id<"tasks">) {
  const task = await requireDiscussion(ctx, taskId, "read");
  const permission = await requireProject(ctx, task.projectId);
  const canCreate =
    (permission.member.role !== "guest" && permission.projectMember.role !== "guest") ||
    task.createdBy === permission.user._id ||
    !!permission.project.guestViewAllFeatures;
  const active = discussionIsActive(task);
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
function requireCommentRevision(comment: Doc<"taskComments">, expectedUpdatedAt: number) {
  if (!Number.isSafeInteger(expectedUpdatedAt) || comment.updatedAt !== expectedUpdatedAt)
    throw new ConvexError("This comment changed. Reload before editing.");
}
async function editableComment(ctx: QueryCtx, commentId: Id<"taskComments">, deleted = false) {
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
function commentEvent(
  ctx: MutationCtx,
  task: Doc<"tasks">,
  actorId: Id<"users">,
  commentId: Id<"taskComments">,
  kind: Extract<Doc<"taskEvents">["kind"], `comment_${string}`>,
  delivery: NonNullable<Parameters<typeof recordTaskEvent>[3]>,
  mentionedUserIds: Id<"users">[] = []
) {
  return recordTaskEvent(
    ctx,
    {
      workspaceId: task.workspaceId,
      projectId: task.projectId,
      taskId: task._id,
      actorId,
      kind,
      status: task.status,
      commentId,
    },
    mentionedUserIds,
    delivery
  );
}
async function insertComment(
  ctx: MutationCtx,
  task: Doc<"tasks">,
  authorId: Id<"users">,
  input: Pick<Doc<"taskComments">, "html" | "audience" | "mentionedUserIds">,
  delivery: NonNullable<Parameters<typeof recordTaskEvent>[3]>
) {
  const commentId = await ctx.db.insert("taskComments", {
    taskId: task._id,
    authorId,
    audience: input.audience,
    mentionedUserIds: input.mentionedUserIds ?? [],
    ...commentContent(input.html),
    updatedAt: Date.now(),
    editedAt: null,
    deletedAt: null,
  });
  await commentEvent(ctx, task, authorId, commentId, "comment_created", delivery, input.mentionedUserIds);
  return commentId;
}
async function updateComment(
  ctx: MutationCtx,
  task: Doc<"tasks">,
  comment: Doc<"taskComments">,
  actorId: Id<"users">,
  input: Partial<Pick<Doc<"taskComments">, "html" | "audience" | "mentionedUserIds">> & { expectedUpdatedAt: number },
  delivery: NonNullable<Parameters<typeof recordTaskEvent>[3]>
) {
  requireCommentRevision(comment, input.expectedUpdatedAt);
  const content = input.html === undefined ? { html: comment.html, text: comment.text } : commentContent(input.html);
  const audience = input.audience ?? comment.audience;
  const previousMentions = comment.mentionedUserIds ?? [];
  const mentionedUserIds = input.mentionedUserIds ?? previousMentions;
  if (
    content.html === comment.html &&
    audience === comment.audience &&
    mentionedUserIds.length === previousMentions.length &&
    mentionedUserIds.every((id) => previousMentions.includes(id))
  )
    return comment._id;
  const updatedAt = Math.max(Date.now(), comment.updatedAt + 1);
  await ctx.db.patch(comment._id, { ...content, audience, mentionedUserIds, updatedAt, editedAt: updatedAt });
  await commentEvent(
    ctx,
    task,
    actorId,
    comment._id,
    "comment_updated",
    delivery,
    mentionedUserIds.filter((id) => !previousMentions.includes(id))
  );
  return comment._id;
}
async function removeComment(
  ctx: MutationCtx,
  task: Doc<"tasks">,
  comment: Doc<"taskComments">,
  actorId: Id<"users">,
  expectedUpdatedAt: number,
  delivery: NonNullable<Parameters<typeof recordTaskEvent>[3]>
) {
  requireCommentRevision(comment, expectedUpdatedAt);
  const updatedAt = Math.max(Date.now(), comment.updatedAt + 1);
  await ctx.db.patch(comment._id, { deletedAt: updatedAt, updatedAt });
  await commentEvent(ctx, task, actorId, comment._id, "comment_deleted", delivery);
}
export const list = query({
  args: { taskId: v.id("tasks"), deleted: v.optional(v.boolean()), paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const permission = await commentAccess(ctx, args.taskId);
    const result = await stream(ctx.db, schema)
      .query("taskComments")
      .withIndex("by_task", (q) => q.eq("taskId", permission.task._id))
      .order("desc")
      .map(async (comment) => {
        const canManage = comment.authorId === permission.user._id || permission.projectMember.role === "admin";
        if ((comment.deletedAt != null) !== (args.deleted ?? false) || (args.deleted && !canManage)) return null;
        const author = await ctx.db.get(comment.authorId);
        return Object.assign({}, comment, {
          authorName: author?.name ?? null,
          canEdit: discussionIsActive(permission.task) && comment.deletedAt == null && canManage,
          canRestore: discussionIsActive(permission.task) && comment.deletedAt != null && canManage,
        });
      })
      .paginate({ ...pageBudget(args.paginationOpts, 50), maximumBytesRead: 1_048_576 });
    return { ...result, canCreate: permission.canCreate };
  },
});
export const create = mutation({
  args: {
    taskId: v.id("tasks"),
    html: v.string(),
    audience: commentAudience,
    mentionedUserIds: v.optional(v.array(v.id("users"))),
  },
  handler: async (ctx, args) => {
    const { task, user, canCreate } = await commentAccess(ctx, args.taskId);
    if (!canCreate) throw new ConvexError("Guests can comment only on tasks they created.");
    const mentionedUserIds = await validateMentions(ctx, task, args.mentionedUserIds ?? []);
    return insertComment(ctx, task, user._id, { ...args, mentionedUserIds }, "subscribers");
  },
});
export const update = mutation({
  args: {
    ...revisionFields,
    html: v.optional(v.string()),
    audience: v.optional(commentAudience),
    mentionedUserIds: v.optional(v.array(v.id("users"))),
  },
  handler: async (ctx, args) => {
    const { comment, task, user } = await editableComment(ctx, args.commentId);
    if (args.mentionedUserIds !== undefined) await validateMentions(ctx, task, args.mentionedUserIds);
    return updateComment(ctx, task, comment, user._id, args, "subscribers");
  },
});
export const remove = mutation({
  args: revisionFields,
  handler: async (ctx, args) => {
    const { comment, task, user } = await editableComment(ctx, args.commentId);
    await removeComment(ctx, task, comment, user._id, args.expectedUpdatedAt, "subscribers");
  },
});

export const restore = mutation({
  args: revisionFields,
  handler: async (ctx, args) => {
    const { comment, task, user } = await editableComment(ctx, args.commentId, true);
    requireCommentRevision(comment, args.expectedUpdatedAt);
    await ctx.db.patch(comment._id, { deletedAt: null, updatedAt: Math.max(Date.now(), comment.updatedAt + 1) });
    await commentEvent(ctx, task, user._id, comment._id, "comment_restored", "subscribers");
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

// Anonymous publication reads expose the external comment only, never mention or account metadata.
async function publicComment(ctx: QueryCtx, comment: Doc<"taskComments">) {
  const author = await ctx.db.get(comment.authorId);
  return {
    _id: comment._id,
    _creationTime: comment._creationTime,
    taskId: comment.taskId,
    authorId: comment.authorId,
    html: comment.html,
    text: comment.text,
    audience: comment.audience,
    updatedAt: comment.updatedAt,
    editedAt: comment.editedAt,
    authorName: author?.name ?? null,
  };
}
async function editablePublicComment(
  ctx: QueryCtx,
  anchor: string,
  taskId: Id<"tasks">,
  commentId: Id<"taskComments">
) {
  const permission = await requirePublishedComment(ctx, anchor, taskId, commentId);
  const user = await requireUser(ctx);
  if (permission.comment.authorId !== user._id)
    throw new ConvexError("Only the author can change this public comment.");
  return { ...permission, user };
}
export const publicList = query({
  args: { ...publicTarget, paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const { task } = await requirePublishedDiscussion(ctx, args.anchor, args.taskId);
    return stream(ctx.db, schema)
      .query("taskComments")
      .withIndex("by_task_audience", (q) => q.eq("taskId", task._id).eq("audience", "EXTERNAL"))
      .order("asc")
      .map(async (comment) => (comment.deletedAt == null ? publicComment(ctx, comment) : null))
      .paginate(pageBudget(args.paginationOpts, 50));
  },
});
export const publicGet = query({
  args: { ...publicTarget, commentId: v.id("taskComments") },
  handler: async (ctx, args) =>
    publicComment(ctx, (await requirePublishedComment(ctx, args.anchor, args.taskId, args.commentId)).comment),
});
export const publicCreate = mutation({
  args: { ...publicTarget, html: v.string() },
  handler: async (ctx, args) => {
    const { task } = await requirePublishedDiscussion(ctx, args.anchor, args.taskId);
    const user = await requireUser(ctx);
    return insertComment(ctx, task, user._id, { html: args.html, audience: "EXTERNAL" }, "activity");
  },
});
export const publicUpdate = mutation({
  args: { ...publicTarget, ...revisionFields, html: v.string() },
  handler: async (ctx, args) => {
    const { task, comment, user } = await editablePublicComment(ctx, args.anchor, args.taskId, args.commentId);
    return updateComment(ctx, task, comment, user._id, args, "activity");
  },
});
export const publicRemove = mutation({
  args: { ...publicTarget, ...revisionFields },
  handler: async (ctx, args) => {
    const { task, comment, user } = await editablePublicComment(ctx, args.anchor, args.taskId, args.commentId);
    await removeComment(ctx, task, comment, user._id, args.expectedUpdatedAt, "activity");
  },
});
