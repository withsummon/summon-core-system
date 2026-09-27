import { ConvexError, v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { mutation, query } from "../_generated/server";
import { requireProject } from "../identity/access";
import { pageBudget } from "../commercial/validation";
import { requireTask, taskIsActive } from "./access";
import { taskChanged } from "./revision";
function reactionCode(value: string) {
  if (!/^\d{1,7}(?:-\d{1,7}){0,31}$/.test(value)) throw new ConvexError("Choose a supported reaction code.");
  const points = value.split("-").map(Number);
  if (
    points.some(
      (point) =>
        point > 0x10ffff || (point >= 0xd800 && point <= 0xdfff) || point < 32 || (point >= 127 && point <= 159)
    )
  )
    throw new ConvexError("Choose valid Unicode reaction code points.");
  return points.join("-");
}
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
    const page = await Promise.all(
      result.page.map(async (row) => {
        const actor = await ctx.db.get(row.actorId);
        return { ...row, actorName: actor?.name ?? null, isMine: row.actorId === user._id };
      })
    );
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
    if (args.active && existing) return existing._id;
    if (!args.active && !existing) return null;
    if (existing) {
      await ctx.db.patch(existing._id, { deletedAt: Date.now() });
      await taskChanged(ctx, task, user._id);
      return null;
    }
    const id = await ctx.db.insert("taskReactions", { taskId: task._id, actorId: user._id, reaction, deletedAt: null });
    await taskChanged(ctx, task, user._id);
    return id;
  },
});
