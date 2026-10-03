import { ConvexError, type Infer } from "convex/values";
import type { QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { taskIsActive } from "../tasks/access";
import { status } from "../tasks/schema";

export function publicationForProject(ctx: QueryCtx, projectId: Id<"projects">) {
  return ctx.db
    .query("projectPublications")
    .withIndex("by_project", (q) => q.eq("projectId", projectId))
    .unique();
}

// Anonymous access is owned by the current publication, never by project membership.
// Every query reads this row and its ancestors so revoke/archive/delete invalidates subscriptions.
export async function requirePublishedProject(ctx: QueryCtx, anchor: string) {
  const publication = await ctx.db
    .query("projectPublications")
    .withIndex("by_anchor", (q) => q.eq("anchor", anchor))
    .unique();
  if (!publication || publication.revokedAt !== null) throw new ConvexError("Project is not published.");
  const project = await ctx.db.get(publication.projectId);
  if (!project || project.archived || project.deletedAt != null) throw new ConvexError("Project is not published.");
  const workspace = await ctx.db.get(project.workspaceId);
  if (!workspace || workspace.deletedAt != null) throw new ConvexError("Project is not published.");
  return { publication, project, workspace };
}

export function publishedTask(
  task: Doc<"tasks">,
  { project }: Awaited<ReturnType<typeof requirePublishedProject>>
): task is Doc<"tasks"> & { status: Infer<typeof status> } {
  return taskIsActive(task) && task.projectId === project._id && task.workspaceId === project.workspaceId;
}

export async function requirePublishedTask(ctx: QueryCtx, anchor: string, taskId: Id<"tasks">) {
  const access = await requirePublishedProject(ctx, anchor);
  const task = await ctx.db.get(taskId);
  if (!task || !publishedTask(task, access)) throw new ConvexError("Work item is not published.");
  return { ...access, task };
}

export async function requirePublishedDiscussion(ctx: QueryCtx, anchor: string, taskId: Id<"tasks">) {
  const access = await requirePublishedTask(ctx, anchor, taskId);
  if (!access.publication.settings.commentsEnabled) throw new ConvexError("Public comments are disabled.");
  return access;
}

export async function requirePublishedComment(
  ctx: QueryCtx,
  anchor: string,
  taskId: Id<"tasks">,
  commentId: Id<"taskComments">
) {
  const access = await requirePublishedDiscussion(ctx, anchor, taskId);
  const comment = await ctx.db.get(commentId);
  if (!comment || comment.taskId !== taskId || comment.audience !== "EXTERNAL" || comment.deletedAt != null)
    throw new ConvexError("Comment not found.");
  return { ...access, comment };
}
