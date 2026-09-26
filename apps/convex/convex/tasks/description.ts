import { v } from "convex/values";
import { mutation, query } from "../_generated/server";
import type { MutationCtx } from "../_generated/server";
import type { Doc } from "../_generated/dataModel";
import { requireProject } from "../identity/access";
import { requireTask } from "./properties";
import { plainDescriptionHtml, taskRichContent } from "./rich_content";
import { requireTaskRevision, taskChanged } from "./revision";

// Existing public text updates keep their meaning and replace rich formatting
// only when the caller actually changes the plain description.
export async function syncPlainDescription(ctx: MutationCtx, task: Doc<"tasks">, text: string) {
  if (text === task.description) return;
  const existing = await ctx.db
    .query("taskDescriptions")
    .withIndex("by_task", (q) => q.eq("taskId", task._id))
    .unique();
  if (existing) await ctx.db.patch(existing._id, { html: plainDescriptionHtml(text) });
}
export const get = query({
  args: { taskId: v.id("tasks") },
  handler: async (ctx, { taskId }) => {
    const task = await requireTask(ctx, taskId);
    await requireProject(ctx, task.projectId);
    const rich = await ctx.db
      .query("taskDescriptions")
      .withIndex("by_task", (q) => q.eq("taskId", taskId))
      .unique();
    return { taskId, html: rich?.html ?? plainDescriptionHtml(task.description), updatedAt: task.updatedAt };
  },
});
export const save = mutation({
  args: { taskId: v.id("tasks"), expectedUpdatedAt: v.number(), html: v.string() },
  handler: async (ctx, args) => {
    const task = await requireTask(ctx, args.taskId);
    const { user } = await requireProject(ctx, task.projectId, true);
    requireTaskRevision(task, args.expectedUpdatedAt);
    const content = taskRichContent(args.html);
    const rich = await ctx.db
      .query("taskDescriptions")
      .withIndex("by_task", (q) => q.eq("taskId", task._id))
      .unique();
    if (rich) await ctx.db.patch(rich._id, { html: content.html });
    else await ctx.db.insert("taskDescriptions", { taskId: task._id, html: content.html });
    await ctx.db.patch(task._id, { description: content.description });
    await taskChanged(ctx, task, user._id);
    return task._id;
  },
});
