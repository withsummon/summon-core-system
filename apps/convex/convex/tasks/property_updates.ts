import { ConvexError, type Infer } from "convex/values";
import type { MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { requireTask } from "./access";
import { requireProject } from "../identity/access";
import { requireTaskRevision, taskChanged } from "./revision";
import { validateProperties } from "./properties";
import { status, taskProperties } from "./schema";
import { v } from "convex/values";
const properties = v.object(taskProperties);
export async function preparePropertyUpdate(
  ctx: MutationCtx,
  taskId: Id<"tasks">,
  expectedUpdatedAt: number,
  data: Infer<typeof properties>,
  requestedStatus: Infer<typeof status>
) {
  const task = await requireTask(ctx, taskId);
  const { user, project } = await requireProject(ctx, task.projectId, true);
  requireTaskRevision(task, expectedUpdatedAt);
  const validated = await validateProperties(ctx, project, data, task.estimatePointId);
  if (validated.state && validated.state.status !== requestedStatus)
    throw new ConvexError("Task status must match its custom state.");
  return { task, user, data: validated.data, status: requestedStatus };
}
export async function applyPropertyUpdate(
  ctx: MutationCtx,
  prepared: Awaited<ReturnType<typeof preparePropertyUpdate>>,
  text?: { title: string; description: string }
) {
  const { task, user, data, status: requestedStatus } = prepared;
  const changed = task.status !== requestedStatus || task.stateId !== data.stateId;
  await ctx.db.patch(task._id, {
    ...data,
    ...text,
    status: requestedStatus,
    completedAt: changed ? (requestedStatus === "done" ? Date.now() : null) : task.completedAt,
  });
  await taskChanged(ctx, task, user._id);
}
