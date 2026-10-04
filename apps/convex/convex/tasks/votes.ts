import { ConvexError, v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { mutation, query, type QueryCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { pageBudget } from "../commercial/validation";
import { requireUser } from "../identity/access";
import { requirePublishedTask } from "../publicSharing/access";
import { taskVote } from "./schema";
import { taskChanged } from "./revision";

const target = { anchor: v.string(), taskId: v.id("tasks") };

async function requireVotes(ctx: QueryCtx, anchor: string, taskId: Id<"tasks">) {
  const { publication, task } = await requirePublishedTask(ctx, anchor, taskId);
  if (!publication.settings.votesEnabled) throw new ConvexError("Public votes are disabled.");
  return task;
}

export const summary = query({
  args: target,
  handler: async (ctx, args) => {
    const task = await requireVotes(ctx, args.anchor, args.taskId);
    return { upVotes: task.upVoteCount, downVotes: task.downVoteCount };
  },
});

// Name pages do not own totals or the current viewer's choice.
export const actors = query({
  args: { ...target, vote: taskVote, paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const task = await requireVotes(ctx, args.anchor, args.taskId);
    const result = await ctx.db
      .query("taskVotes")
      .withIndex("by_task_vote_deleted", (q) => q.eq("taskId", task._id).eq("vote", args.vote).eq("deletedAt", null))
      .order("desc")
      .paginate(pageBudget(args.paginationOpts, 50));
    return {
      ...result,
      page: await Promise.all(
        result.page.map(async (row) => ({
          actorId: row.actorId,
          actorName: (await ctx.db.get(row.actorId))?.name ?? null,
        }))
      ),
    };
  },
});

export const viewer = query({
  args: target,
  handler: async (ctx, args) => {
    const task = await requireVotes(ctx, args.anchor, args.taskId);
    const user = await requireUser(ctx);
    const existing = await ctx.db
      .query("taskVotes")
      .withIndex("by_task_actor_deleted", (q) => q.eq("taskId", task._id).eq("actorId", user._id).eq("deletedAt", null))
      .unique();
    return existing?.vote ?? null;
  },
});

// One desired actor state, its exact totals and its activity commit together.
export const set = mutation({
  args: { ...target, vote: v.union(taskVote, v.null()) },
  handler: async (ctx, args) => {
    const task = await requireVotes(ctx, args.anchor, args.taskId);
    const user = await requireUser(ctx);
    const existing = await ctx.db
      .query("taskVotes")
      .withIndex("by_task_actor_deleted", (q) => q.eq("taskId", task._id).eq("actorId", user._id).eq("deletedAt", null))
      .unique();
    const previous = existing?.vote ?? null;
    if (previous === args.vote) return args.vote;
    if (existing)
      await ctx.db.patch(existing._id, args.vote === null ? { deletedAt: Date.now() } : { vote: args.vote });
    else if (args.vote !== null)
      await ctx.db.insert("taskVotes", { taskId: task._id, actorId: user._id, vote: args.vote, deletedAt: null });
    await ctx.db.patch(task._id, {
      upVoteCount: task.upVoteCount + Number(args.vote === 1) - Number(previous === 1),
      downVoteCount: task.downVoteCount + Number(args.vote === -1) - Number(previous === -1),
    });
    await taskChanged(
      ctx,
      task,
      user._id,
      { kind: "vote_changed", changes: [{ field: "vote", before: previous, after: args.vote }] },
      "activity"
    );
    return args.vote;
  },
});
