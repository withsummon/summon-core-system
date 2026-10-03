import { ConvexError, v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { mutation, query } from "../_generated/server";
import type { QueryCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { requireProject } from "../identity/access";
import { pageBudget } from "../commercial/validation";
import { requireDiscussion, discussionIsActive } from "./discussion_access";
import { reactionCode, reactionActor, setReaction } from "./reaction_owner";
const target = { taskId: v.id("tasks"), commentId: v.id("taskComments") };
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
    const reaction = reactionCode(args.reaction);
    const existing = await ctx.db
      .query("taskCommentReactions")
      .withIndex("by_comment_actor_code_deleted", (q) =>
        q.eq("commentId", comment._id).eq("actorId", user._id).eq("reaction", reaction).eq("deletedAt", null)
      )
      .unique();
    return setReaction(ctx, task, user._id, existing, args.active, () =>
      ctx.db.insert("taskCommentReactions", { commentId: comment._id, actorId: user._id, reaction, deletedAt: null })
    );
  },
});
