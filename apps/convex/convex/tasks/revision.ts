import { taskPropertyChanges } from "./activity_changes";
import { recordTaskEvent } from "../notifications/delivery";
import { compareValues, ConvexError } from "convex/values";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { priority, stateApiGroup, stateApiGroupFromStatus } from "./schema";
import { DirectAggregate } from "@convex-dev/aggregate";
import { components } from "../_generated/api";
import { taskIsActive } from "./access";
import { profileIdentity } from "../identity/profile_owner";
import { taskModuleMemberships, taskHasModuleName } from "../modules/tasks";

export const taskCollection = new DirectAggregate<{
  Namespace:
    | Id<"projects">
    | [Id<"users">, "assigned_tasks"]
    | [Id<"modules">, "api_metrics"]
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
          | "assignees__first_name"
          | "issue_module__module__name"
        ),
      ];
  Key: number | [boolean, Doc<"tasks">["startDate" | "completedAt"] | string];
  Id: Id<"tasks">;
}>(components.taskCollection);

function taskModuleApiEntry(task: Doc<"tasks">, moduleId: Id<"modules">) {
  return {
    namespace: [moduleId, "api_metrics"],
    key: [task.stateId === null, task.stateId === null ? null : stateApiGroupFromStatus(task.status)],
    id: task._id,
  } satisfies Parameters<typeof taskCollection.insertIfDoesNotExist>[1];
}

// The public API counts live joins, including triage and tombstoned tasks until unlink.
export async function indexTaskModuleApi(
  ctx: MutationCtx,
  task: Doc<"tasks">,
  moduleId: Id<"modules">,
  assigned = true,
  previous?: Doc<"tasks">
) {
  const item = taskModuleApiEntry(task, moduleId);
  const old = previous ? taskModuleApiEntry(previous, moduleId) : item;
  if (!assigned || task.archivedAt !== null) await taskCollection.deleteIfExists(ctx, old);
  else if (previous?.archivedAt === null) {
    if (compareValues(old.key, item.key) !== 0) await taskCollection.replaceOrInsert(ctx, old, item);
  } else await taskCollection.insertIfDoesNotExist(ctx, item);
}

// Direct-join DISTINCT uses one key per real Task and distinct Module name.
export function taskModuleCollectionEntry(task: Doc<"tasks">, name: string | null) {
  return {
    namespace: [task.projectId, "issue_module__module__name"],
    key: [name === null, name],
    id: task._id,
  } satisfies Parameters<typeof taskCollection.insertIfDoesNotExist>[1];
}

// Single assignments and renames touch only names whose memberships changed.
export async function indexTaskModuleName(ctx: MutationCtx, task: Doc<"tasks">, name: string | null) {
  const entry = taskModuleCollectionEntry(task, name);
  if (taskIsActive(task) && (await taskHasModuleName(ctx, task, name)))
    await taskCollection.insertIfDoesNotExist(ctx, entry);
  else await taskCollection.deleteIfExists(ctx, entry);
}

// Whole relationship edits replace their real preimage after the complete batch.
export async function indexTaskModuleCollection(
  ctx: MutationCtx,
  task: Doc<"tasks">,
  previous?: Doc<"tasks">,
  previousEntries?: Awaited<ReturnType<typeof taskCollectionEntries>>
) {
  const namespace = taskModuleCollectionEntry(task, null).namespace;
  const before = previousEntries ?? (await taskCollectionEntries(ctx, previous ?? task, undefined, namespace));
  const items = taskIsActive(task)
    ? previous || previousEntries
      ? await taskCollectionEntries(ctx, task, undefined, namespace)
      : before
    : [];
  const old = !previous || taskIsActive(previous) ? before : [];
  await Promise.all([
    ...items.map(async (entry) => {
      if (!previous || !old.some((item) => compareValues(item.key, entry.key) === 0))
        await taskCollection.insertIfDoesNotExist(ctx, entry);
    }),
    ...old.map(async (entry) => {
      if (!items.some((item) => compareValues(item.key, entry.key) === 0))
        await taskCollection.deleteIfExists(ctx, entry);
    }),
  ]);
}

// SQL MAX retains blank first names; only a task with no assignees has a null key.
export async function taskAssigneeCollectionEntry(
  ctx: QueryCtx,
  task: Doc<"tasks">,
  resolved?: NonNullable<Awaited<ReturnType<typeof profileIdentity>>>[]
): Promise<Parameters<typeof taskCollection.insertIfDoesNotExist>[1]> {
  const identities = resolved ?? (await Promise.all(task.assigneeIds.map((id) => profileIdentity(ctx, id))));
  const names = new Map(
    identities.filter((identity) => identity !== null).map((identity) => [identity.userId, identity.firstName])
  );
  let firstName: string | null = null;
  for (const id of task.assigneeIds) {
    const name = names.get(id);
    if (name === undefined)
      throw new ConvexError({ status: 503, detail: "Task collection index requires reconciliation." });
    if (firstName === null || compareValues(name, firstName) > 0) firstName = name;
  }
  return { namespace: [task.projectId, "assignees__first_name"], key: [firstName === null, firstName], id: task._id };
}

export async function taskCollectionEntries(
  ctx: QueryCtx,
  task: Doc<"tasks">,
  resolvedLabels?: Doc<"taskLabels">[],
  namespace?: Parameters<typeof taskCollection.count>[1]["namespace"],
  resolvedAssignees?: NonNullable<Awaited<ReturnType<typeof profileIdentity>>>[]
): Promise<Parameters<typeof taskCollection.insertIfDoesNotExist>[1][]> {
  if (namespace && compareValues(namespace, [task.projectId, "issue_module__module__name"]) === 0) {
    const names = new Set<string | null>();
    for await (const { module } of taskModuleMemberships(ctx, task)) names.add(module.name);
    if (!names.size) names.add(null);
    return [...names].map((name) => taskModuleCollectionEntry(task, name));
  }
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
  if (namespace === undefined || compareValues(namespace, [task.projectId, "assignees__first_name"]) === 0)
    entries.push(await taskAssigneeCollectionEntry(ctx, task, resolvedAssignees));
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
  const assignees = await Promise.all(
    [...new Set([...task.assigneeIds, ...(previous?.assigneeIds ?? [])])].map(async (id) => {
      const identity = await profileIdentity(ctx, id);
      if (!identity) throw new ConvexError({ status: 503, detail: "Task collection index requires reconciliation." });
      return identity;
    })
  );
  const items = await taskCollectionEntries(ctx, task, labels, undefined, assignees);
  // One producer keeps entry positions identical for the real before/current documents.
  const before = previousEntries ?? (await taskCollectionEntries(ctx, previous ?? task, labels, undefined, assignees));
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
  if (!previous || taskIsActive(task) !== taskIsActive(previous)) await indexTaskModuleCollection(ctx, task, previous);
  if (
    !previous ||
    task.archivedAt !== previous.archivedAt ||
    task.stateId !== previous.stateId ||
    task.status !== previous.status
  ) {
    // The all-task backfill and state/archive writers use the same live membership owner.
    // oxlint-disable-next-line no-await-in-loop
    for await (const { module } of taskModuleMemberships(ctx, task))
      await indexTaskModuleApi(ctx, task, module._id, true, previous);
  }
  const current = new Set(taskIsActive(task) ? task.assigneeIds : []);
  const old = new Set(previous && taskIsActive(previous) ? previous.assigneeIds : []);
  await Promise.all(
    [...new Set([...task.assigneeIds, ...(previous?.assigneeIds ?? [])])].map(async (userId) => {
      const entry: Parameters<typeof taskCollection.insertIfDoesNotExist>[1] = {
        namespace: [userId, "assigned_tasks"],
        key: task._creationTime,
        id: task._id,
      };
      if (current.has(userId) && (!previous || !old.has(userId))) await taskCollection.insertIfDoesNotExist(ctx, entry);
      else if (!current.has(userId) && (!previous || old.has(userId))) await taskCollection.deleteIfExists(ctx, entry);
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
  delivery: NonNullable<Parameters<typeof recordTaskEvent>[3]> | "none" = "subscribers",
  mentionedUserIds: Id<"users">[] = [],
  commentBefore: string | null = null
) {
  const current = await ctx.db.get(task._id);
  if (!current) throw new ConvexError("Task not found.");
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
  if (delivery === "none") return updatedAt;
  // Manual reordering advances the revision without creating a subscriber activity.
  if (
    !event &&
    task.sortOrder !== current.sortOrder &&
    compareValues({ ...task, sortOrder: current.sortOrder }, current) === 0
  )
    return updatedAt;
  const changes = [...(await taskPropertyChanges(ctx, task, current)), ...(event?.changes ?? [])];
  let kind: Doc<"taskEvents">["kind"] = event?.kind ?? "updated";
  if (task.deletedAt !== current.deletedAt) kind = current.deletedAt === null ? "restored" : "deleted";
  else if (task.archivedAt !== current.archivedAt) kind = current.archivedAt === null ? "unarchived" : "archived";
  else if (changes.some((change) => change.field === "state")) kind = "status_changed";
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
