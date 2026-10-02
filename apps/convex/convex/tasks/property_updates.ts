import { compareValues, ConvexError, v, type Infer } from "convex/values";
import type { MutationCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { requireTask } from "./access";
import { requireProject } from "../identity/access";
import { requireTaskRevision, taskChanged } from "./revision";
import { validateProperties } from "./properties";
import { status, taskPosition, taskProperties } from "./schema";
const properties = v.object(taskProperties).partial();
export async function preparePropertyUpdate(
  ctx: MutationCtx,
  taskId: Id<"tasks">,
  expectedUpdatedAt: number,
  data: Infer<typeof properties>,
  requestedStatus?: Infer<typeof status>
) {
  const task = await requireTask(ctx, taskId);
  const { user, project } = await requireProject(ctx, task.projectId, true);
  requireTaskRevision(task, expectedUpdatedAt);
  const validated = await validateProperties(ctx, project, { ...task, ...data }, task);
  const nextStatus = requestedStatus ?? validated.state?.status ?? task.status;
  if (validated.state && validated.state.status !== nextStatus)
    throw new ConvexError("Task status must match its custom state.");
  return { task, user, data: validated.data, status: nextStatus };
}
export async function applyPropertyUpdate(
  ctx: MutationCtx,
  prepared: Awaited<ReturnType<typeof preparePropertyUpdate>>,
  fields?: Partial<Pick<Doc<"tasks">, "title" | "description" | "sortOrder">>
) {
  const { task, user, data, status: requestedStatus } = prepared;
  const patch = { ...data, ...fields, status: requestedStatus };
  if (compareValues({ ...task, ...patch }, task) === 0) return false;
  const changed = task.status !== requestedStatus || task.stateId !== data.stateId;
  await ctx.db.patch(task._id, {
    ...patch,
    completedAt: changed ? (requestedStatus === "done" ? Date.now() : null) : task.completedAt,
  });
  await taskChanged(ctx, task, user._id);
  return true;
}

export async function taskPositionOrder(ctx: MutationCtx, task: Doc<"tasks">, position: Infer<typeof taskPosition>) {
  const neighbors = await Promise.all(
    [position.previous, position.next].map(async (neighbor) => {
      if (!neighbor) return null;
      const current = await requireTask(ctx, neighbor.taskId);
      if (current._id === task._id || current.workspaceId !== task.workspaceId)
        throw new ConvexError("Choose other work items in this workspace as ordering neighbors.");
      requireTaskRevision(current, neighbor.expectedUpdatedAt);
      if (!Number.isFinite(current.sortOrder)) throw new ConvexError("This work item's order needs repair.");
      return current.sortOrder;
    })
  );
  const [previous, next] = neighbors;
  const sortOrder =
    previous === null
      ? next === null
        ? 65535
        : next - 10000
      : next === null
        ? previous + 10000
        : previous / 2 + next / 2;
  if (
    !Number.isFinite(sortOrder) ||
    (previous !== null && sortOrder <= previous) ||
    (next !== null && sortOrder >= next)
  )
    throw new ConvexError("These work items have no available ordering gap. Choose another position.");
  return sortOrder;
}
