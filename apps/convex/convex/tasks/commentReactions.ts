import { ConvexError, v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { mutation, query } from "../_generated/server";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { requireProject, requireUser } from "../identity/access";
import { requirePublishedComment, requirePublishedReactions } from "../publicSharing/access";
import { pageBudget } from "../commercial/validation";
import { requireDiscussion, discussionIsActive } from "./discussion_access";
import { reactionCode, reactionActor, publicReaction, setReaction } from "./reaction_owner";
const target = { taskId: v.id("tasks"), commentId: v.id("taskComments") };
async function setCommentReaction(
  ctx: MutationCtx,
  task: Doc<"tasks">,
  commentId: Id<"taskComments">,
  actorId: Id<"users">,
  code: string,
  active: boolean,
  delivery: NonNullable<Parameters<typeof setReaction>[6]> = "subscribers"
) {
  const reaction = reactionCode(code);
  const existing = await ctx.db
    .query("taskCommentReactions")
    .withIndex("by_comment_actor_code_deleted", (q) =>
      q.eq("commentId", commentId).eq("actorId", actorId).eq("reaction", reaction).eq("deletedAt", null)
    )
    .unique();
  return setReaction(
    ctx,
    task,
    actorId,
    existing,
    active,
    () => ctx.db.insert("taskCommentReactions", { commentId, actorId, reaction, deletedAt: null }),
    delivery
  );
}
async function requireComment(ctx: QueryCtx, taskId: Id<"tasks">, commentId: Id<"taskComments">, write = false) {
  const task = await requireDiscussion(ctx, taskId, write ? "active" : "read");
  const comment = await ctx.db.get(commentId);
  if (!comment || comment.taskId !== task._id || comment.deletedAt != null) throw new ConvexError("Comment not found.");
  const { user } = await requireProject(ctx, task.projectId);
  return { task, comment, user };
}
export const access = query({
  args: target,
  handler: async (ctx, args) => ({
    canReact: discussionIsActive((await requireComment(ctx, args.taskId, args.commentId)).task),
  }),
});
export const list = query({
  args: { ...target, paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const { comment, user } = await requireComment(ctx, args.taskId, args.commentId);
    const result = await ctx.db
      .query("taskCommentReactions")
      .withIndex("by_comment_deleted", (q) => q.eq("commentId", comment._id).eq("deletedAt", null))
      .order("desc")
      .paginate(pageBudget(args.paginationOpts));
    return { ...result, page: await Promise.all(result.page.map((row) => reactionActor(ctx, row, user._id))) };
  },
});
export const set = mutation({
  args: { ...target, reaction: v.string(), active: v.boolean() },
  handler: async (ctx, args) => {
    const { task, comment, user } = await requireComment(ctx, args.taskId, args.commentId, true);
    return setCommentReaction(ctx, task, comment._id, user._id, args.reaction, args.active);
  },
});
export const publicList = query({
  args: { ...target, anchor: v.string(), paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const publication = await requirePublishedComment(ctx, args.anchor, args.taskId, args.commentId);
    requirePublishedReactions(publication);
    const result = await ctx.db
      .query("taskCommentReactions")
      .withIndex("by_comment_deleted", (q) => q.eq("commentId", publication.comment._id).eq("deletedAt", null))
      .order("desc")
      .paginate(pageBudget(args.paginationOpts));
    return { ...result, page: await Promise.all(result.page.map((row) => publicReaction(ctx, row))) };
  },
});
export const publicSet = mutation({
  args: { ...target, anchor: v.string(), reaction: v.string(), active: v.boolean() },
  handler: async (ctx, args) => {
    const publication = await requirePublishedComment(ctx, args.anchor, args.taskId, args.commentId);
    requirePublishedReactions(publication);
    const user = await requireUser(ctx);
    return setCommentReaction(
      ctx,
      publication.task,
      publication.comment._id,
      user._id,
      args.reaction,
      args.active,
      "activity"
    );
  },
});
