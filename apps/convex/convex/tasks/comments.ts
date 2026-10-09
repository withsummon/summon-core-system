import { validateMentions } from "../notifications/mentions";
import { paginationOptsValidator } from "convex/server";
import { stream } from "convex-helpers/server/stream";
import { compareValues, ConvexError, v } from "convex/values";
import { internalMutation, mutation, query } from "../_generated/server";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { requireUser } from "../identity/access";
import { taskChanged } from "./revision";
import { pageBudget } from "../commercial/validation";
import {
  requirePublishedComment,
  requirePublishedDiscussion,
  requirePublishedCommentAvatar,
} from "../publicSharing/access";
import { publicProfileIdentity } from "../identity/profile_owner";
import { userAppearance } from "../identity/avatar_owner";
import schema from "../schema";
import { requireCommentAccess, requireEditableComment, discussionIsActive } from "./discussion_access";
import { imageRichContent } from "./rich_content";
import { bindCommentImages } from "../assets/commentImages";
import { allocateTaskCompanionApiId, commentAudience, commentRequestId, taskTables } from "./schema";
import { apiIdSchema } from "../identity/schema";
import { zodToConvex } from "convex-helpers/server/zod4";

const revisionFields = { commentId: v.id("taskComments"), expectedUpdatedAt: v.number() };
const publicTarget = { anchor: v.string(), taskId: v.id("tasks") };
export const access = query({
  args: { taskId: v.id("tasks") },
  handler: async (ctx, args) => {
    const { canCreate } = await requireCommentAccess(ctx, args.taskId);
    return { canCreate };
  },
});

// Native historical rows recorded author/creation time, never an updater or external identity.
// Remove this missing-only owner after both hosts prove coverage and second-pass zero changes.
export const adoptApiIdentity = internalMutation({
  args: {
    expected: v.array(
      v.object({ ...taskTables.taskComments.validator.fields, _id: v.id("taskComments"), _creationTime: v.number() })
    ),
  },
  handler: async (ctx, args) => {
    if (args.expected.length < 1 || args.expected.length > 20)
      throw new ConvexError("Adopt between 1 and 20 exact Comment preimages.");
    const changes = [];
    /* oxlint-disable no-await-in-loop */
    for (const expected of args.expected) {
      const current = await ctx.db.get(expected._id);
      if (!current || compareValues(current, expected) !== 0)
        throw new ConvexError("Comment changed. Capture its current preimage before adoption.");
      if (
        [
          current.apiId,
          current.createdAt,
          current.createdBy,
          current.updatedBy,
          current.commentJsonText,
          current.externalSource,
          current.externalId,
          current.descriptionApiId,
          current.attachments,
          current.parentId,
          current.projectId,
          current.workspaceId,
        ].every((value) => value !== undefined)
      )
        continue;
      const task = await ctx.db.get(current.taskId);
      const project = task ? await ctx.db.get(task.projectId) : null;
      if (
        !task ||
        !project ||
        project.workspaceId !== task.workspaceId ||
        !(await ctx.db.get(task.workspaceId)) ||
        !(await ctx.db.get(current.authorId)) ||
        (current.projectId !== undefined && current.projectId !== task.projectId) ||
        (current.workspaceId !== undefined && current.workspaceId !== task.workspaceId)
      )
        throw new ConvexError("Comment scope is inconsistent.");
      await ctx.db.patch(current._id, {
        ...(current.apiId === undefined ? { apiId: await allocateTaskCompanionApiId(ctx, "taskComments") } : {}),
        ...(current.createdAt === undefined ? { createdAt: current._creationTime } : {}),
        ...(current.createdBy === undefined ? { createdBy: current.authorId } : {}),
        ...(current.updatedBy === undefined ? { updatedBy: null } : {}),
        ...(current.commentJsonText === undefined ? { commentJsonText: "{}" } : {}),
        ...(current.externalSource === undefined ? { externalSource: null } : {}),
        ...(current.externalId === undefined ? { externalId: null } : {}),
        ...(current.descriptionApiId === undefined ? { descriptionApiId: apiIdSchema.parse(crypto.randomUUID()) } : {}),
        ...(current.attachments === undefined ? { attachments: [] } : {}),
        ...(current.parentId === undefined ? { parentId: null } : {}),
        ...(current.projectId === undefined ? { projectId: task.projectId } : {}),
        ...(current.workspaceId === undefined ? { workspaceId: task.workspaceId } : {}),
      });
      changes.push({ before: current, after: await ctx.db.get(current._id) });
    }
    /* oxlint-enable no-await-in-loop */
    return changes;
  },
});
export function commentCreation(
  input: Pick<NonNullable<Doc<"taskComments">["creation"]>, "requestId" | "audience" | "anchor"> &
    Pick<Doc<"taskComments">, "html" | "mentionedUserIds">
) {
  const requestId = commentRequestId.safeParse(input.requestId);
  if (!requestId.success) throw new ConvexError("Provide a UUID for this comment creation request.");
  return {
    requestId: requestId.data,
    html: input.html,
    audience: input.audience,
    mentionedUserIds: input.mentionedUserIds ?? [],
    anchor: input.anchor,
  };
}
function requireCommentRevision(comment: Doc<"taskComments">, expectedUpdatedAt: number) {
  if (!Number.isSafeInteger(expectedUpdatedAt) || comment.updatedAt !== expectedUpdatedAt)
    throw new ConvexError("This comment changed. Reload before editing.");
}
function commentEvent(
  ctx: MutationCtx,
  task: Doc<"tasks">,
  actorId: Id<"users">,
  commentId: Id<"taskComments">,
  kind: Extract<Doc<"taskEvents">["kind"], `comment_${string}`>,
  delivery: NonNullable<Parameters<typeof taskChanged>[4]>,
  mentionedUserIds: Id<"users">[] = [],
  commentBefore: string | null = null
) {
  return taskChanged(ctx, task, actorId, { kind, commentId }, delivery, mentionedUserIds, commentBefore);
}
export async function insertComment(
  ctx: MutationCtx,
  task: Doc<"tasks">,
  authorId: Id<"users">,
  input: ReturnType<typeof commentCreation> &
    Partial<Pick<Doc<"taskComments">, "createdAt" | "createdBy" | "commentJsonText" | "externalSource" | "externalId">>,
  delivery: NonNullable<Parameters<typeof taskChanged>[4]>,
  imageTarget: Parameters<typeof bindCommentImages>[1] = {
    taskId: task._id,
    requestId: input.requestId,
    anchor: input.anchor,
  }
) {
  const {
    html,
    createdAt: suppliedCreatedAt,
    createdBy,
    commentJsonText,
    externalSource,
    externalId,
    ...intent
  } = input;
  const content = imageRichContent(html);
  const creation = {
    ...intent,
    htmlSha256: await crypto.subtle.digest("SHA-256", new TextEncoder().encode(content.html)),
  };
  const existing = await ctx.db
    .query("taskComments")
    .withIndex("by_author_task_creation_request", (q) =>
      q.eq("authorId", authorId).eq("taskId", task._id).eq("creation.requestId", creation.requestId)
    )
    .unique();
  if (existing) {
    if (compareValues(existing.creation, creation) !== 0)
      throw new ConvexError("This comment request already belongs to another creation payload.");
    if (creation.anchor !== null) await requirePublishedComment(ctx, creation.anchor, task._id, existing._id);
    if (existing.deletedAt != null) throw new ConvexError("This comment was deleted. Restore it before editing.");
    return existing._id;
  }
  if (creation.anchor === null) await validateMentions(ctx, task, creation.mentionedUserIds);
  const updatedAt = Date.now();
  const createdAt = suppliedCreatedAt ?? updatedAt;
  const commentId = await ctx.db.insert("taskComments", {
    workspaceId: task.workspaceId,
    projectId: task.projectId,
    apiId: await allocateTaskCompanionApiId(ctx, "taskComments"),
    createdAt,
    createdBy: createdBy === undefined ? authorId : createdBy,
    updatedBy: null,
    commentJsonText: commentJsonText ?? "{}",
    externalSource: externalSource ?? null,
    externalId: externalId ?? null,
    descriptionApiId: apiIdSchema.parse(crypto.randomUUID()),
    attachments: [],
    parentId: null,
    taskId: task._id,
    authorId,
    creation,
    audience: creation.audience,
    mentionedUserIds: creation.mentionedUserIds,
    html: content.html,
    text: content.description,
    updatedAt,
    editedAt: null,
    deletedAt: null,
  });
  await bindCommentImages(ctx, imageTarget, content, commentId);
  await commentEvent(ctx, task, authorId, commentId, "comment_created", delivery, creation.mentionedUserIds);
  return commentId;
}
export async function updateComment(
  ctx: MutationCtx,
  task: Doc<"tasks">,
  comment: Doc<"taskComments">,
  actorId: Id<"users">,
  input: Partial<
    Pick<
      Doc<"taskComments">,
      "html" | "audience" | "mentionedUserIds" | "commentJsonText" | "externalSource" | "externalId"
    >
  > & { expectedUpdatedAt: number },
  delivery: NonNullable<Parameters<typeof taskChanged>[4]>,
  anchor: string | null = null,
  imageTarget: Parameters<typeof bindCommentImages>[1] = { taskId: task._id, commentId: comment._id, anchor }
) {
  requireCommentRevision(comment, input.expectedUpdatedAt);
  const content =
    input.html === undefined
      ? { html: comment.html, text: comment.text }
      : await bindCommentImages(ctx, imageTarget, imageRichContent(input.html), comment._id);
  const audience = input.audience ?? comment.audience;
  const previousMentions = comment.mentionedUserIds ?? [];
  const mentionedUserIds = input.mentionedUserIds ?? previousMentions;
  if (
    !("task" in imageTarget) &&
    content.html === comment.html &&
    (input.commentJsonText === undefined || input.commentJsonText === comment.commentJsonText) &&
    (input.externalSource === undefined || input.externalSource === comment.externalSource) &&
    (input.externalId === undefined || input.externalId === comment.externalId) &&
    audience === comment.audience &&
    mentionedUserIds.length === previousMentions.length &&
    mentionedUserIds.every((id) => previousMentions.includes(id))
  )
    return comment._id;
  const updatedAt = Math.max(Date.now(), comment.updatedAt + 1);
  const contentChanged =
    content.html !== comment.html ||
    (input.commentJsonText !== undefined && input.commentJsonText !== comment.commentJsonText);
  await ctx.db.patch(comment._id, {
    ...content,
    audience,
    mentionedUserIds,
    updatedAt,
    updatedBy: actorId,
    ...(input.commentJsonText === undefined ? {} : { commentJsonText: input.commentJsonText }),
    ...(input.externalSource === undefined ? {} : { externalSource: input.externalSource }),
    ...(input.externalId === undefined ? {} : { externalId: input.externalId }),
    editedAt: !("task" in imageTarget) && contentChanged ? updatedAt : comment.editedAt,
  });
  await commentEvent(
    ctx,
    task,
    actorId,
    comment._id,
    "comment_updated",
    delivery,
    mentionedUserIds.filter((id) => !previousMentions.includes(id)),
    comment.text
  );
  return comment._id;
}
export async function removeComment(
  ctx: MutationCtx,
  task: Doc<"tasks">,
  comment: Doc<"taskComments">,
  actorId: Id<"users">,
  expectedUpdatedAt: number,
  delivery: NonNullable<Parameters<typeof taskChanged>[4]>
) {
  requireCommentRevision(comment, expectedUpdatedAt);
  const updatedAt = Math.max(Date.now(), comment.updatedAt + 1);
  await ctx.db.patch(comment._id, { deletedAt: updatedAt, updatedAt, updatedBy: actorId });
  await commentEvent(ctx, task, actorId, comment._id, "comment_deleted", delivery, [], comment.text);
}
export const list = query({
  args: { taskId: v.id("tasks"), deleted: v.optional(v.boolean()), paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const permission = await requireCommentAccess(ctx, args.taskId);
    const result = await stream(ctx.db, schema)
      .query("taskComments")
      .withIndex("by_task", (q) => q.eq("taskId", permission.task._id))
      .order("desc")
      .map(async (comment) => {
        const canManage = comment.authorId === permission.user._id || permission.projectMember.role === "admin";
        if ((comment.deletedAt != null) !== (args.deleted ?? false) || (args.deleted && !canManage)) return null;
        const author = await ctx.db.get(comment.authorId);
        const { creation: _creation, ...current } = comment;
        return Object.assign({}, current, {
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
    requestId: zodToConvex(commentRequestId),
    html: v.string(),
    audience: commentAudience,
    mentionedUserIds: v.optional(v.array(v.id("users"))),
  },
  handler: async (ctx, args) => {
    const { task, user, canCreate } = await requireCommentAccess(ctx, args.taskId);
    if (!canCreate) throw new ConvexError("Guests can comment only on tasks they created.");
    return insertComment(
      ctx,
      task,
      user._id,
      commentCreation({
        requestId: args.requestId,
        html: args.html,
        audience: args.audience,
        mentionedUserIds: args.mentionedUserIds,
        anchor: null,
      }),
      "subscribers"
    );
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
    const { comment, task, user } = await requireEditableComment(ctx, args.commentId);
    if (args.mentionedUserIds !== undefined) await validateMentions(ctx, task, args.mentionedUserIds);
    return updateComment(ctx, task, comment, user._id, args, "subscribers");
  },
});
export const remove = mutation({
  args: revisionFields,
  handler: async (ctx, args) => {
    const { comment, task, user } = await requireEditableComment(ctx, args.commentId);
    await removeComment(ctx, task, comment, user._id, args.expectedUpdatedAt, "subscribers");
  },
});

export const restore = mutation({
  args: revisionFields,
  handler: async (ctx, args) => {
    const { comment, task, user } = await requireEditableComment(ctx, args.commentId, true);
    requireCommentRevision(comment, args.expectedUpdatedAt);
    await ctx.db.patch(comment._id, {
      deletedAt: null,
      updatedAt: Math.max(Date.now(), comment.updatedAt + 1),
      updatedBy: user._id,
    });
    await commentEvent(ctx, task, user._id, comment._id, "comment_restored", "subscribers");
    return comment._id;
  },
});

// Notification links resolve a canonical comment even when its chronological page is not loaded.
export const get = query({
  args: { taskId: v.id("tasks"), commentId: v.string() },
  handler: async (ctx, args) => {
    await requireCommentAccess(ctx, args.taskId);
    const id = ctx.db.normalizeId("taskComments", args.commentId);
    const comment = id ? await ctx.db.get(id) : null;
    if (!comment || comment.taskId !== args.taskId || comment.deletedAt != null)
      throw new ConvexError("Comment not found.");
    const author = await ctx.db.get(comment.authorId);
    const { creation: _creation, ...current } = comment;
    return { ...current, mentionedUserIds: comment.mentionedUserIds ?? [], authorName: author?.name ?? null };
  },
});

// Anonymous publication reads expose the external comment only, never mention or account metadata.
async function publicComment(ctx: QueryCtx, anchor: string, comment: Doc<"taskComments">) {
  const author = await publicProfileIdentity(ctx, comment.authorId);
  const appearance = author ? await userAppearance(ctx, comment.authorId) : null;
  const avatar = appearance?.avatarAssetId
    ? await requirePublishedCommentAvatar(ctx, anchor, comment.taskId, comment._id, appearance.avatarAssetId)
    : null;
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
    authorAvatar: avatar
      ? {
          id: avatar._id,
          name: avatar.name,
          contentType: avatar.contentType,
          size: avatar.size,
          downloadPath: `/assets/${avatar._id}?anchor=${encodeURIComponent(anchor)}&task=${comment.taskId}&comment=${comment._id}&purpose=commentAvatar`,
        }
      : null,
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
      .map(async (comment) => (comment.deletedAt == null ? publicComment(ctx, args.anchor, comment) : null))
      .paginate(pageBudget(args.paginationOpts, 50));
  },
});
export const publicGet = query({
  args: { ...publicTarget, commentId: v.id("taskComments") },
  handler: async (ctx, args) =>
    publicComment(
      ctx,
      args.anchor,
      (await requirePublishedComment(ctx, args.anchor, args.taskId, args.commentId)).comment
    ),
});
export const publicCreate = mutation({
  args: { ...publicTarget, requestId: zodToConvex(commentRequestId), html: v.string() },
  handler: async (ctx, args) => {
    const { task } = await requirePublishedDiscussion(ctx, args.anchor, args.taskId);
    const user = await requireUser(ctx);
    return insertComment(
      ctx,
      task,
      user._id,
      commentCreation({ requestId: args.requestId, html: args.html, audience: "EXTERNAL", anchor: args.anchor }),
      "activity"
    );
  },
});
export const publicUpdate = mutation({
  args: { ...publicTarget, ...revisionFields, html: v.string() },
  handler: async (ctx, args) => {
    const { task, comment, user } = await editablePublicComment(ctx, args.anchor, args.taskId, args.commentId);
    return updateComment(ctx, task, comment, user._id, args, "activity", args.anchor);
  },
});
export const publicRemove = mutation({
  args: { ...publicTarget, ...revisionFields },
  handler: async (ctx, args) => {
    const { task, comment, user } = await editablePublicComment(ctx, args.anchor, args.taskId, args.commentId);
    await removeComment(ctx, task, comment, user._id, args.expectedUpdatedAt, "activity");
  },
});
