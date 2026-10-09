import { contentVersion, descriptionVersion, requireDescriptionVersion, writeDescription } from "./description_content";
import { v } from "convex/values";
import { mutation, query } from "../_generated/server";
import type { MutationCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { requireProject } from "../identity/access";
import { requireTask } from "./access";
import { plainDescriptionHtml } from "./rich_content";
import { boundDescriptionContent } from "./description_images";
import { taskChanged } from "./revision";

// Existing public text updates keep their meaning and replace rich formatting
// only when the caller actually changes the plain description.
export async function syncPlainDescription(ctx: MutationCtx, task: Doc<"tasks">, text: string, actorId: Id<"users">) {
  if (text === task.description) return;
  await writeDescription(ctx, task, actorId, { html: plainDescriptionHtml(text), description: text });
}
export const get = query({
  args: { taskId: v.id("tasks") },
  handler: async (ctx, { taskId }) => {
    const task = await requireTask(ctx, taskId, "read");
    await requireProject(ctx, task.projectId);
    const rich = await ctx.db
      .query("taskDescriptions")
      .withIndex("by_task", (q) => q.eq("taskId", taskId))
      .unique();
    return {
      taskId,
      html: rich?.html ?? plainDescriptionHtml(task.description),
      descriptionJson: rich?.descriptionJson ?? null,
      descriptionBinary: rich?.descriptionBinary ?? null,
      updatedAt: task.updatedAt,
      contentVersion: await descriptionVersion(ctx, taskId),
    };
  },
});
export const save = mutation({
  args: {
    taskId: v.id("tasks"),
    expectedContentVersion: contentVersion,
    html: v.string(),
  },
  handler: async (ctx, args) => {
    const task = await requireTask(ctx, args.taskId);
    const { user } = await requireProject(ctx, task.projectId, true);
    await requireDescriptionVersion(ctx, task._id, args.expectedContentVersion);
    const content = await boundDescriptionContent(ctx, task._id, args.html);
    const changed = await writeDescription(ctx, task, user._id, content);
    if (changed) await taskChanged(ctx, task, user._id);
    return { contentVersion: await descriptionVersion(ctx, task._id), html: content.html };
  },
});
