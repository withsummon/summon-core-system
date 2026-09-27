import type { Infer } from "convex/values";
import type { QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import type { taskChange } from "./schema";
type Change = Infer<typeof taskChange>;
async function stateSnapshot(ctx: QueryCtx, task: Doc<"tasks">) {
  const state = task.stateId ? await ctx.db.get(task.stateId) : null;
  return {
    status: task.status,
    id: task.stateId,
    name: state?.projectId === task.projectId && state.workspaceId === task.workspaceId ? state.name : null,
  };
}
async function estimateSnapshot(ctx: QueryCtx, task: Doc<"tasks">) {
  if (!task.estimatePointId) return null;
  const point = await ctx.db.get(task.estimatePointId);
  return { id: task.estimatePointId, value: point?.projectId === task.projectId ? point.value : null };
}
function difference<T>(next: T[], previous: T[]) {
  const prior = new Set(previous);
  return [...new Set(next)].filter((id) => !prior.has(id));
}
async function members(ctx: QueryCtx, ids: Id<"users">[]) {
  return Promise.all(ids.map(async (id) => ({ id, name: (await ctx.db.get(id))?.name ?? null })));
}
async function labels(ctx: QueryCtx, task: Doc<"tasks">, ids: Id<"taskLabels">[]) {
  return Promise.all(
    ids.map(async (id) => {
      const label = await ctx.db.get(id);
      return {
        id,
        name: label?.workspaceId === task.workspaceId && label.projectId === task.projectId ? label.name : null,
      };
    })
  );
}
/** Capture task-owned audit values in the same transaction, before taxonomy cleanup deletes rows. */
export async function taskPropertyChanges(ctx: QueryCtx, before: Doc<"tasks">, after: Doc<"tasks">): Promise<Change[]> {
  const changes: Change[] = [];
  if (before.title !== after.title) changes.push({ field: "title", before: before.title, after: after.title });
  if (before.priority !== after.priority)
    changes.push({ field: "priority", before: before.priority, after: after.priority });
  if (before.status !== after.status || before.stateId !== after.stateId)
    changes.push({ field: "state", before: await stateSnapshot(ctx, before), after: await stateSnapshot(ctx, after) });
  if (before.startDate !== after.startDate)
    changes.push({ field: "startDate", before: before.startDate, after: after.startDate });
  if (before.targetDate !== after.targetDate)
    changes.push({ field: "targetDate", before: before.targetDate, after: after.targetDate });
  const addedMembers = difference(after.assigneeIds, before.assigneeIds);
  const removedMembers = difference(before.assigneeIds, after.assigneeIds);
  if (addedMembers.length || removedMembers.length)
    changes.push({
      field: "assignees",
      added: await members(ctx, addedMembers),
      removed: await members(ctx, removedMembers),
    });
  const addedLabels = difference(after.labelIds, before.labelIds);
  const removedLabels = difference(before.labelIds, after.labelIds);
  if (addedLabels.length || removedLabels.length)
    changes.push({
      field: "labels",
      added: await labels(ctx, after, addedLabels),
      removed: await labels(ctx, before, removedLabels),
    });
  if (before.estimatePointId !== after.estimatePointId)
    changes.push({
      field: "estimate",
      before: await estimateSnapshot(ctx, before),
      after: await estimateSnapshot(ctx, after),
    });
  return changes;
}
