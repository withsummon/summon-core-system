import { taskPropertyChanges } from "./activity_changes";
import { recordTaskEvent } from "../notifications/delivery";
import { compareValues, ConvexError } from "convex/values";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { priority, stateApiGroup, stateApiGroupFromStatus } from "./schema";
import { DirectAggregate } from "@convex-dev/aggregate";
import { components } from "../_generated/api";
import { taskIsActive } from "./access";

export const taskCollection = new DirectAggregate<{
  Namespace:
    | Id<"projects">
    | [
        Id<"projects">,
        (
          | "sequence_id"
          | "sort_order"
          | "updated_at"
          | "start_date"
          | "target_date"
          | "completed_at"
          | "priority"
          | "state__group"
          | "-state__group"
          | "labels__name"
        ),
      ];
  Key: number | [boolean, Doc<"tasks">["startDate" | "completedAt"] | string];
  Id: Id<"tasks">;
}>(components.taskCollection);

export async function taskCollectionEntries(
  ctx: QueryCtx,
  task: Doc<"tasks">,
  resolvedLabels?: Doc<"taskLabels">[],
  namespace?: Parameters<typeof taskCollection.count>[1]["namespace"]
): Promise<Parameters<typeof taskCollection.insertIfDoesNotExist>[1][]> {
  const defaultStateRank = stateApiGroup.options.indexOf("triage");
  const stateRank =
    task.stateId === null ? defaultStateRank : stateApiGroup.options.indexOf(stateApiGroupFromStatus(task.status));
  const entries: Parameters<typeof taskCollection.insertIfDoesNotExist>[1][] = [
    { namespace: task.projectId, key: task._creationTime, id: task._id },
    { namespace: [task.projectId, "sequence_id"], key: task.sequence, id: task._id },
    { namespace: [task.projectId, "sort_order"], key: task.sortOrder, id: task._id },
    { namespace: [task.projectId, "updated_at"], key: task.updatedAt, id: task._id },
    { namespace: [task.projectId, "start_date"], key: [task.startDate === null, task.startDate], id: task._id },
    { namespace: [task.projectId, "target_date"], key: [task.targetDate === null, task.targetDate], id: task._id },
    { namespace: [task.projectId, "completed_at"], key: [task.completedAt === null, task.completedAt], id: task._id },
    { namespace: [task.projectId, "priority"], key: task.priorityOrder, id: task._id },
    { namespace: [task.projectId, "state__group"], key: stateRank, id: task._id },
    {
      namespace: [task.projectId, "-state__group"],
      key: stateRank === defaultStateRank ? defaultStateRank : defaultStateRank - 1 - stateRank,
      id: task._id,
    },
  ];
  if (namespace !== undefined && compareValues(namespace, [task.projectId, "labels__name"]) !== 0) return entries;
  const labels = resolvedLabels
    ? new Map(resolvedLabels.map((label) => [label._id, label] as const))
    : new Map(await Promise.all(task.labelIds.map(async (id) => [id, await ctx.db.get(id)] as const)));
  let labelName: string | null = null;
  for (const id of task.labelIds) {
    const label = labels.get(id);
    if (!label || label.projectId !== task.projectId || label.workspaceId !== task.workspaceId)
      throw new ConvexError({ status: 503, detail: "Task collection index requires reconciliation." });
    if (labelName === null || compareValues(label.name, labelName) > 0) labelName = label.name;
  }
  entries.push({ namespace: [task.projectId, "labels__name"], key: [labelName === null, labelName], id: task._id });
  return entries;
}

// Synchronous tolerant writes keep live mutations and a paginated backfill in one transaction.
export async function indexTaskCollection(
  ctx: MutationCtx,
  task: Doc<"tasks">,
  previous?: Doc<"tasks">,
  previousEntries?: Awaited<ReturnType<typeof taskCollectionEntries>>
) {
  const labels = await Promise.all(
    [...new Set([...task.labelIds, ...(previous?.labelIds ?? [])])].map(async (id) => {
      const label = await ctx.db.get(id);
      if (!label) throw new ConvexError({ status: 503, detail: "Task collection index requires reconciliation." });
      return label;
    })
  );
  const items = await taskCollectionEntries(ctx, task, labels);
  // One producer keeps entry positions identical for the real before/current documents.
  const before = previousEntries ?? (await taskCollectionEntries(ctx, previous ?? task, labels));
  await Promise.all(
    items.map(async (item, index) => {
      const old = before[index];
      if (taskIsActive(task)) {
        if (previous && taskIsActive(previous)) {
          if (compareValues(old.key, item.key) !== 0) await taskCollection.replaceOrInsert(ctx, old, item);
        } else await taskCollection.insertIfDoesNotExist(ctx, item);
      } else if (!previous || taskIsActive(previous)) await taskCollection.deleteIfExists(ctx, old);
    })
  );
}

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
  mentionedUserIds: Id<"users">[] = [],
  commentBefore: string | null = null
) {
  const current = await ctx.db.get(task._id);
  if (!current) throw new ConvexError("Task not found.");
  const changes = [...(await taskPropertyChanges(ctx, task, current)), ...(event?.changes ?? [])];
  let kind: Doc<"taskEvents">["kind"] = event?.kind ?? "updated";
  if (task.deletedAt !== current.deletedAt) kind = current.deletedAt === null ? "restored" : "deleted";
  else if (task.archivedAt !== current.archivedAt) kind = current.archivedAt === null ? "unarchived" : "archived";
  else if (changes.some((change) => change.field === "state")) kind = "status_changed";
  const updatedAt = Math.max(Date.now(), current.updatedAt + 1);
  const revision = {
    updatedBy: actorId,
    updatedAt,
    titleUpdatedAt: current.title !== task.title ? updatedAt : current.titleUpdatedAt,
    startDateMissing: current.startDate === null,
    targetDateMissing: current.targetDate === null,
    priorityOrder: priority.members.findIndex(({ value }) => value === current.priority),
  };
  await ctx.db.patch(task._id, revision);
  await indexTaskCollection(ctx, { ...current, ...revision }, { ...task, updatedAt: current.updatedAt });
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
    delivery,
    commentBefore
  );
  return updatedAt;
}
