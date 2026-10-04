import { taskPropertyChanges } from "./activity_changes";
import { recordTaskEvent } from "../notifications/delivery";
import { compareValues, ConvexError } from "convex/values";
import type { MutationCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { priority } from "./schema";
export function requireTaskRevision(task: Doc<"tasks">, expectedUpdatedAt: number) {
  if (!Number.isSafeInteger(expectedUpdatedAt) || expectedUpdatedAt !== task.updatedAt)
    throw new ConvexError("This task changed while you were editing. Reopen the latest task before saving.");
}
export async function taskChanged(
  ctx: MutationCtx,
  task: Doc<"tasks">,
  actorId: Id<"users">,
  event?: Pick<Doc<"taskEvents">, "kind" | "changes" | "commentId" | "automation">,
  delivery: NonNullable<Parameters<typeof recordTaskEvent>[3]> = "subscribers",
  mentionedUserIds: Id<"users">[] = []
) {
  const current = await ctx.db.get(task._id);
  if (!current) throw new ConvexError("Task not found.");
  const changes = [...(await taskPropertyChanges(ctx, task, current)), ...(event?.changes ?? [])];
  let kind: Doc<"taskEvents">["kind"] = event?.kind ?? "updated";
  if (task.deletedAt !== current.deletedAt) kind = current.deletedAt === null ? "restored" : "deleted";
  else if (task.archivedAt !== current.archivedAt) kind = current.archivedAt === null ? "unarchived" : "archived";
  else if (changes.some((change) => change.field === "state")) kind = "status_changed";
  const updatedAt = Math.max(Date.now(), current.updatedAt + 1);
  await ctx.db.patch(task._id, {
    updatedAt,
    titleUpdatedAt: current.title !== task.title ? updatedAt : current.titleUpdatedAt,
    startDateMissing: current.startDate === null,
    priorityOrder: priority.members.findIndex(({ value }) => value === current.priority),
  });
  // Manual reordering advances the revision without creating a subscriber activity.
  if (
    !event &&
    task.sortOrder !== current.sortOrder &&
    compareValues({ ...task, sortOrder: current.sortOrder }, current) === 0
  )
    return updatedAt;
  await recordTaskEvent(
    ctx,
    {
      workspaceId: task.workspaceId,
      projectId: task.projectId,
      taskId: task._id,
      actorId,
      ...event,
      kind,
      status: current.status,
      changes,
    },
    mentionedUserIds,
    delivery
  );
  return updatedAt;
}
