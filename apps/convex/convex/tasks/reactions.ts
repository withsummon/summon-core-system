import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { mutation, query } from "../_generated/server";
import { requireProject } from "../identity/access";
import { pageBudget } from "../commercial/validation";
import { requireTask, taskIsActive } from "./access";
import { reactionCode, reactionActor, setReaction } from "./reaction_owner";
export const access = query({
  args: { taskId: v.id("tasks") },
  handler: async (ctx, args) => ({ canReact: taskIsActive(await requireTask(ctx, args.taskId, "read")) }),
});
export const list = query({
  args: { taskId: v.id("tasks"), paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const task = await requireTask(ctx, args.taskId, "read");
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
    const task = await requireTask(ctx, args.taskId);
    const { user } = await requireProject(ctx, task.projectId);
    const reaction = reactionCode(args.reaction);
    const existing = await ctx.db
      .query("taskReactions")
      .withIndex("by_task_actor_code_deleted", (q) =>
        q.eq("taskId", task._id).eq("actorId", user._id).eq("reaction", reaction).eq("deletedAt", null)
      )
      .unique();
    return setReaction(ctx, task, user._id, existing, args.active, () =>
      ctx.db.insert("taskReactions", { taskId: task._id, actorId: user._id, reaction, deletedAt: null })
    );
  },
});
