import { writeDescription } from "./description_content";
import { plainDescriptionHtml } from "./rich_content";
import type { MutationCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { recordTaskEvent } from "../notifications/delivery";
import { checkAncestors } from "./hierarchy";
import { taskChanged } from "./revision";
// Both ordinary creation and intake submission allocate identity here, in the caller transaction.
export async function createTask(
  ctx: MutationCtx,
  project: Doc<"projects">,
  userId: Id<"users">,
  fields: Pick<
    Doc<"tasks">,
    | "title"
    | "description"
    | "status"
    | "priority"
    | "assigneeIds"
    | "labelIds"
    | "startDate"
    | "targetDate"
    | "stateId"
  >,
  parent: Doc<"tasks"> | null = null,
  html?: string
) {
  const { title, description, status: nextStatus, ...data } = fields;
  const taskId = await ctx.db.insert("tasks", {
    archivedAt: null,
    deletedAt: null,
    workspaceId: project.workspaceId,
    projectId: project._id,
    title,
    description,
    ...data,
    completedAt: nextStatus === "done" ? Date.now() : null,
    status: nextStatus,
    sequence: project.nextSequence,
    createdBy: userId,
    updatedAt: Date.now(),
  });
  const created = await ctx.db.get(taskId);
  if (!created) throw new Error("Created task missing from transaction.");
  await writeDescription(ctx, created, userId, { html: html ?? plainDescriptionHtml(description), description }, true);
  await ctx.db.insert("taskSubscriptions", { taskId, userId: userId });
  if (parent) {
    await checkAncestors(ctx, taskId, parent);
    await ctx.db.insert("taskParents", {
      projectId: project._id,
      childId: taskId,
      parentId: parent._id,
    });
    await taskChanged(ctx, parent, userId);
  }
  await ctx.db.patch(project._id, { nextSequence: project.nextSequence + 1 });
  await recordTaskEvent(ctx, {
    workspaceId: project.workspaceId,
    projectId: project._id,
    taskId,
    actorId: userId,
    kind: "created",
    status: nextStatus,
  });
  return taskId;
}
