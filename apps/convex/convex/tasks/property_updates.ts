import { compareValues, ConvexError, v, type Infer } from "convex/values";
import type { MutationCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { requireTask } from "./access";
import { requireProject } from "../identity/access";
import { requireTaskRevision, taskChanged } from "./revision";
import { validateProperties } from "./properties";
import { status, taskPosition, taskProperties } from "./schema";
import { draftFields } from "./drafts/fields";
import { readTaskParent, prepareParentChange, applyParentChange } from "./hierarchy";
import { prepareCycleChange, applyCycleChange } from "../cycles/tasks";
import { prepareModuleChanges, applyModuleTask } from "../modules/tasks";
export const editableFields = v.object({ title: v.string(), status, properties: v.object(taskProperties) });
export const relationshipEdits = {
  parent: v.optional(v.object({ previous: draftFields.parent, next: draftFields.parent })),
  cycle: v.optional(v.object({ previous: draftFields.cycle, next: draftFields.cycle })),
  modules: v.optional(v.object({ previous: draftFields.modules, next: draftFields.modules })),
};
const relationships = v.object(relationshipEdits);
const properties = v.object(taskProperties).partial();
export async function preparePropertyUpdate(
  ctx: MutationCtx,
  taskId: Id<"tasks">,
  expectedUpdatedAt: number,
  data: Infer<typeof properties>,
  requestedStatus?: Infer<typeof status>,
  expectedEdit?: Infer<typeof editableFields>
) {
  const task = await requireTask(ctx, taskId);
  const { user, project } = await requireProject(ctx, task.projectId, true);
  if (expectedEdit) {
    // Edit compares its owned values; attachment/order-only changes commute. ABA equality is accepted.
    const current = {
      title: task.title,
      status: task.status,
      properties: (await validateProperties(ctx, project, task, task)).data,
    };
    if (compareValues(current, expectedEdit) !== 0)
      throw new ConvexError("Editable work item fields changed. Reopen the latest work item before saving.");
  } else requireTaskRevision(task, expectedUpdatedAt);
  const validated = await validateProperties(ctx, project, { ...task, ...data }, task);
  const nextStatus = requestedStatus ?? validated.state?.status ?? task.status;
  if (validated.state && validated.state.status !== nextStatus)
    throw new ConvexError("Task status must match its custom state.");
  return { task, user, data: validated.data, status: nextStatus };
}
export async function prepareRelationshipUpdate(
  ctx: MutationCtx,
  task: Doc<"tasks">,
  edits: Infer<typeof relationships>
) {
  if (edits.parent) {
    const current = await readTaskParent(ctx, task);
    if (
      current.hasParent !== (edits.parent.previous !== null) ||
      (current.task?._id ?? null) !== (edits.parent.previous?.taskId ?? null)
    )
      throw new ConvexError("Parent membership changed or is unavailable. Reopen the work item before saving.");
    if (current.task && edits.parent.previous)
      requireTaskRevision(current.task, edits.parent.previous.expectedUpdatedAt);
  }
  const [parent, cycle, modules] = await Promise.all([
    edits.parent ? prepareParentChange(ctx, task, edits.parent.next) : null,
    edits.cycle ? prepareCycleChange(ctx, task, edits.cycle.previous, edits.cycle.next) : null,
    edits.modules ? prepareModuleChanges(ctx, task, edits.modules.previous, edits.modules.next) : [],
  ]);
  return { parent, cycle, modules };
}
export async function applyRelationshipUpdate(
  ctx: MutationCtx,
  prepared: Awaited<ReturnType<typeof prepareRelationshipUpdate>>
) {
  if (prepared.parent) await applyParentChange(ctx, prepared.parent);
  const [cycle, modules] = await Promise.all([
    prepared.cycle ? applyCycleChange(ctx, prepared.cycle) : [],
    Promise.all(prepared.modules.map((change) => applyModuleTask(ctx, change))),
  ]);
  return {
    changed: prepared.parent !== null || prepared.cycle !== null || prepared.modules.length > 0,
    changes: [...cycle, ...modules.flat()],
  };
}
export async function applyPropertyUpdate(
  ctx: MutationCtx,
  prepared: Awaited<ReturnType<typeof preparePropertyUpdate>>,
  fields?: Partial<Pick<Doc<"tasks">, "title" | "description" | "sortOrder">>,
  event?: Parameters<typeof taskChanged>[3]
) {
  const { task, user, data, status: requestedStatus } = prepared;
  const patch = { ...data, ...fields, status: requestedStatus };
  if (compareValues({ ...task, ...patch }, task) === 0) return false;
  const changed = task.status !== requestedStatus || task.stateId !== data.stateId;
  await ctx.db.patch(task._id, {
    ...patch,
    completedAt: changed ? (requestedStatus === "done" ? Date.now() : null) : task.completedAt,
  });
  await taskChanged(ctx, task, user._id, event);
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
