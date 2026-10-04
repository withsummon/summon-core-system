import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { mutation, query } from "../_generated/server";
import type { MutationCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { requireProject, requireUser } from "../identity/access";
import { requirePublishedReactions, requirePublishedTask } from "../publicSharing/access";
import { pageBudget } from "../commercial/validation";
import { requireDiscussion, discussionIsActive } from "./discussion_access";
import { reactionCode, reactionActor, publicReaction, setReaction } from "./reaction_owner";
async function setTaskReaction(
  ctx: MutationCtx,
  task: Doc<"tasks">,
  actorId: Id<"users">,
  code: string,
  active: boolean,
  delivery: NonNullable<Parameters<typeof setReaction>[6]> = "subscribers"
) {
  const reaction = reactionCode(code);
  const existing = await ctx.db
    .query("taskReactions")
    .withIndex("by_task_actor_code_deleted", (q) =>
      q.eq("taskId", task._id).eq("actorId", actorId).eq("reaction", reaction).eq("deletedAt", null)
    )
    .unique();
  return setReaction(
    ctx,
    task,
    actorId,
    existing,
    active,
    () => ctx.db.insert("taskReactions", { taskId: task._id, actorId, reaction, deletedAt: null }),
    delivery
  );
}
export const access = query({
  args: { taskId: v.id("tasks") },
  handler: async (ctx, args) => ({ canReact: discussionIsActive(await requireDiscussion(ctx, args.taskId, "read")) }),
});
export const list = query({
  args: { taskId: v.id("tasks"), paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const task = await requireDiscussion(ctx, args.taskId, "read");
    const { user } = await requireProject(ctx, task.projectId);
    const result = await ctx.db
      .query("taskReactions")
      .withIndex("by_task_deleted", (q) => q.eq("taskId", task._id).eq("deletedAt", null))
      .order("desc")
      .paginate(pageBudget(args.paginationOpts));
    const page = await Promise.all(result.page.map((row) => reactionActor(ctx, row, user._id)));
    return { ...result, page };
  },
});
export const set = mutation({
  args: { taskId: v.id("tasks"), reaction: v.string(), active: v.boolean() },
  handler: async (ctx, args) => {
    const task = await requireDiscussion(ctx, args.taskId);
    const { user } = await requireProject(ctx, task.projectId);
    return setTaskReaction(ctx, task, user._id, args.reaction, args.active);
  },
});
export const publicList = query({
  args: { anchor: v.string(), taskId: v.id("tasks"), paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const publication = await requirePublishedTask(ctx, args.anchor, args.taskId);
    requirePublishedReactions(publication);
    const result = await ctx.db
      .query("taskReactions")
      .withIndex("by_task_deleted", (q) => q.eq("taskId", publication.task._id).eq("deletedAt", null))
      .order("desc")
      .paginate(pageBudget(args.paginationOpts));
    return { ...result, page: await Promise.all(result.page.map((row) => publicReaction(ctx, row))) };
  },
});
export const publicSet = mutation({
  args: { anchor: v.string(), taskId: v.id("tasks"), reaction: v.string(), active: v.boolean() },
  handler: async (ctx, args) => {
    const publication = await requirePublishedTask(ctx, args.anchor, args.taskId);
    requirePublishedReactions(publication);
    const user = await requireUser(ctx);
    return setTaskReaction(ctx, publication.task, user._id, args.reaction, args.active, "activity");
  },
});
