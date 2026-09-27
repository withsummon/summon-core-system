import { recordTaskEvent } from "../notifications/delivery";
import { ConvexError } from "convex/values";
import type { MutationCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
export function requireTaskRevision(task: Doc<"tasks">, expectedUpdatedAt: number) {
  if (!Number.isSafeInteger(expectedUpdatedAt) || expectedUpdatedAt !== task.updatedAt)
    throw new ConvexError("This task changed while you were editing. Reopen the latest task before saving.");
}
export async function taskChanged(ctx: MutationCtx, task: Doc<"tasks">, actorId: Id<"users">) {
  const updatedAt = Math.max(Date.now(), task.updatedAt + 1);
  await ctx.db.patch(task._id, { updatedAt });
  await recordTaskEvent(ctx, {
    workspaceId: task.workspaceId,
    projectId: task.projectId,
    taskId: task._id,
    actorId,
    kind: "updated",
    status: task.status,
  });
  return updatedAt;
}
