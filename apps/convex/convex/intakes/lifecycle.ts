import { ConvexError, v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import type { Doc } from "../_generated/dataModel";
import { query, mutation } from "../_generated/server";
import { requireProject } from "../identity/access";
import { pageBudget } from "../commercial/validation";
import type { QueryCtx } from "../_generated/server";
import { writeTaskLifecycle } from "../tasks/lifecycle";
import { plainDescriptionHtml } from "../tasks/rich_content";
import { intakeCapabilities, requireIntakeTask, requireIntakeRevision } from "./access";

// A bridge can undo only the task deletion committed by its own removal.
// Current task CAS alone is insufficient: an independently deleted task can have a fresh captured revision.
async function restoration(ctx: QueryCtx, intake: Doc<"intakeTasks">, task: Doc<"tasks">) {
  if (
    await ctx.db
      .query("taskDeletionJobs")
      .withIndex("by_task", (q) => q.eq("taskId", task._id))
      .unique()
  )
    return { canRestore: false, restoresTask: false, restoreBlockedReason: "API-retired tasks cannot be restored." };
  if (intake.status === "accepted" || task.deletedAt == null)
    return { canRestore: true, restoresTask: false, restoreBlockedReason: null };
  const ownsDeletion =
    intake.removalTaskRevision !== undefined &&
    intake.removalTaskRevision !== null &&
    intake.removalTaskRevision === task.updatedAt &&
    intake.deletedAt === task.deletedAt;
  return {
    canRestore: ownsDeletion,
    restoresTask: ownsDeletion,
    restoreBlockedReason: ownsDeletion
      ? null
      : "This task was deleted or changed separately. Recover it through its owning workflow before restoring the submission.",
  };
}
export const list = query({
  args: { projectId: v.id("projects"), paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const access = await requireProject(ctx, args.projectId);
    const result = await ctx.db
      .query("intakeTasks")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .order("desc")
      .paginate(pageBudget(args.paginationOpts));
    const rows = await Promise.all(
      result.page.map(async (intake) => {
        if (intake.deletedAt === null || !intakeCapabilities(access, intake.createdBy).canRemove) return null;
        const task = await ctx.db.get(intake.taskId);
        if (!task) return null;
        return { intake, task, ...(await restoration(ctx, intake, task)) };
      })
    );
    return { ...result, page: rows.filter((row) => row !== null) };
  },
});
export const get = query({
  args: { projectId: v.id("projects"), taskId: v.string() },
  handler: async (ctx, args) => {
    const taskId = ctx.db.normalizeId("tasks", args.taskId);
    if (!taskId) throw new ConvexError("Intake task not found.");
    const { task, intake } = await requireIntakeTask(ctx, taskId, "removed");
    if (task.projectId !== args.projectId) throw new ConvexError("Intake task not found.");
    const rich = await ctx.db
      .query("taskDescriptions")
      .withIndex("by_task", (q) => q.eq("taskId", taskId))
      .unique();
    return {
      task,
      intake,
      html: rich?.html ?? plainDescriptionHtml(task.description),
      ...(await restoration(ctx, intake, task)),
    };
  },
});
export const restore = mutation({
  args: { taskId: v.id("tasks"), expectedUpdatedAt: v.number(), expectedTaskUpdatedAt: v.number() },
  handler: async (ctx, args) => {
    const { task, intake, access } = await requireIntakeTask(ctx, args.taskId, "removed");
    requireIntakeRevision(intake, task, args.expectedUpdatedAt, args.expectedTaskUpdatedAt);
    const plan = await restoration(ctx, intake, task);
    if (plan.restoreBlockedReason !== null) throw new ConvexError(plan.restoreBlockedReason);
    if (plan.restoresTask) {
      await writeTaskLifecycle(ctx, task, access.user._id, "deletedAt", false);
    }
    await ctx.db.patch(intake._id, {
      deletedAt: null,
      removalTaskRevision: null,
      updatedAt: Math.max(Date.now(), intake.updatedAt + 1),
    });
    return { taskId: task._id, restoredTask: plan.restoresTask };
  },
});
