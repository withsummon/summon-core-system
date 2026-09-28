import { taskPropertyChanges } from "./activity_changes";
import { recordTaskEvent } from "../notifications/delivery";
import { ConvexError } from "convex/values";
import type { MutationCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { priority } from "./schema";
export function requireTaskRevision(task: Doc<"tasks">, expectedUpdatedAt: number) {
  if (!Number.isSafeInteger(expectedUpdatedAt) || expectedUpdatedAt !== task.updatedAt)
    throw new ConvexError("This task changed while you were editing. Reopen the latest task before saving.");
}
export async function taskChanged(ctx: MutationCtx, task: Doc<"tasks">, actorId: Id<"users">) {
  const current = await ctx.db.get(task._id);
  if (!current) throw new ConvexError("Task not found.");
  const changes = await taskPropertyChanges(ctx, task, current);
  const updatedAt = Math.max(Date.now(), current.updatedAt + 1);
  await ctx.db.patch(task._id, {
    updatedAt,
    titleUpdatedAt: current.title !== task.title ? updatedAt : current.titleUpdatedAt,
    startDateMissing: current.startDate === null,
    priorityOrder: priority.members.findIndex(({ value }) => value === current.priority),
  });
  await recordTaskEvent(ctx, {
    workspaceId: task.workspaceId,
    projectId: task.projectId,
    taskId: task._id,
    actorId,
    kind: changes.some((change) => change.field === "state") ? "status_changed" : "updated",
    status: current.status,
    changes,
  });
  return updatedAt;
}
