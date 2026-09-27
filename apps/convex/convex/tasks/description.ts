import { contentVersion, descriptionVersion, requireDescriptionVersion, writeDescription } from "./description_content";
import { ConvexError, v } from "convex/values";
import { mutation, query } from "../_generated/server";
import type { MutationCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { requireProject } from "../identity/access";
import { requireTask } from "./access";
import { plainDescriptionHtml } from "./rich_content";
import { boundDescriptionContent } from "./description_images";
import { requireTaskRevision, taskChanged } from "./revision";

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
    expectedUpdatedAt: v.optional(v.number()),
    expectedContentVersion: v.optional(contentVersion),
    html: v.string(),
  },
  handler: async (ctx, args) => {
    const task = await requireTask(ctx, args.taskId);
    const { user } = await requireProject(ctx, task.projectId, true);
    // Existing deployed form uses task CAS until the generated content-token consumer is activated.
    if (args.expectedContentVersion !== undefined) {
      if (args.expectedUpdatedAt !== undefined) throw new ConvexError("Choose one description revision.");
      await requireDescriptionVersion(ctx, task._id, args.expectedContentVersion);
    } else {
      if (args.expectedUpdatedAt === undefined) throw new ConvexError("Description revision is required.");
      requireTaskRevision(task, args.expectedUpdatedAt);
    }
    const content = await boundDescriptionContent(ctx, task._id, args.html);
    await writeDescription(ctx, task, user._id, content);
    await taskChanged(ctx, task, user._id);
    return task._id;
  },
});
