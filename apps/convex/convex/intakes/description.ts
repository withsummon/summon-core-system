import { ConvexError, v } from "convex/values";
import { query, mutation } from "../_generated/server";
import { requireIntakeTask } from "./access";
import { boundDescriptionContent } from "../tasks/description_images";
import {
  contentVersion,
  descriptionVersion,
  requireDescriptionVersion,
  writeDescription,
} from "../tasks/description_content";
import { plainDescriptionHtml } from "../tasks/rich_content";
import { taskChanged } from "../tasks/revision";
export const get = query({
  args: { taskId: v.id("tasks") },
  handler: async (ctx, { taskId }) => {
    const { task, canEdit } = await requireIntakeTask(ctx, taskId);
    const rich = await ctx.db
      .query("taskDescriptions")
      .withIndex("by_task", (q) => q.eq("taskId", taskId))
      .unique();
    return {
      taskId,
      html: rich?.html ?? plainDescriptionHtml(task.description),
      canEdit,
      contentVersion: await descriptionVersion(ctx, taskId),
    };
  },
});
export const save = mutation({
  args: { taskId: v.id("tasks"), expectedContentVersion: contentVersion, html: v.string() },
  handler: async (ctx, args) => {
    const { task, intake, access, canEdit } = await requireIntakeTask(ctx, args.taskId);
    if (!canEdit) throw new ConvexError("You cannot edit this submission's description.");
    await requireDescriptionVersion(ctx, task._id, args.expectedContentVersion);
    const content = await boundDescriptionContent(ctx, task._id, args.html);
    await writeDescription(ctx, task, access.user._id, content);
    await taskChanged(ctx, task, access.user._id);
    await ctx.db.patch(intake._id, { updatedAt: Math.max(Date.now(), intake.updatedAt + 1) });
    return task._id;
  },
});
