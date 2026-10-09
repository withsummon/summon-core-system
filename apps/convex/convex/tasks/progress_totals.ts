import { memberLabel } from "../../shared/member-label";
import { compareValues, ConvexError } from "convex/values";
import type { PaginationOptions } from "convex/server";
import type { QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { taskCanRead, taskIsActive } from "./access";
import { memberIdentity } from "../projects/directory";
import { taskCollection, taskModuleApiEntry } from "./revision";
import { stateApiGroup, status } from "./schema";

export function progressPageBudget(options: PaginationOptions) {
  if (!Number.isSafeInteger(options.numItems) || options.numItems < 1 || options.numItems > 20)
    throw new ConvexError("Request 1–20 memberships per progress page.");
  return { ...options, maximumRowsRead: 20, maximumBytesRead: 1_048_576 };
}
export async function currentProgress(
  ctx: QueryCtx,
  taskIds: Id<"tasks">[],
  project: Doc<"projects">,
  userId: Id<"users">,
  viewerWorkspaceRole: Doc<"workspaceMembers">["role"]
) {
  const tasks = await Promise.all(
    taskIds.map(async (taskId) => {
      const task = await ctx.db.get(taskId);
      return task &&
        task.projectId === project._id &&
        task.workspaceId === project.workspaceId &&
        taskIsActive(task) &&
        (await taskCanRead(ctx, task, userId))
        ? task
        : null;
    })
  );
  return progressTotals(
    ctx,
    tasks.filter((task) => task !== null),
    viewerWorkspaceRole
  );
}
type Totals = { count: number; numericEstimates: number; unquantifiedEstimates: number };
type ProgressTotals = Totals & { completed: Totals; pending: Totals };
type Bucket = ProgressTotals & { id: string | null; name: string };
function emptyTotals(): Totals {
  return { count: 0, numericEstimates: 0, unquantifiedEstimates: 0 };
}
function emptyProgress(): ProgressTotals {
  return { ...emptyTotals(), completed: emptyTotals(), pending: emptyTotals() };
}
function tally(value: Totals, estimate: number | null, hasEstimate: boolean, count: number) {
  value.count += count;
  if (estimate !== null) value.numericEstimates += estimate * count;
  else if (hasEstimate) value.unquantifiedEstimates += count;
}
function contribute(
  value: ProgressTotals,
  estimate: number | null,
  hasEstimate: boolean,
  completed: boolean,
  count = 1
) {
  tally(value, estimate, hasEstimate, count);
  tally(completed ? value.completed : value.pending, estimate, hasEstimate, count);
}
function add(
  map: Map<string | null, Bucket>,
  id: string | null,
  name: string,
  estimate: number | null,
  hasEstimate: boolean,
  completed: boolean,
  count = 1
) {
  if (count === 0) return;
  const value = map.get(id) ?? { id, name, ...emptyProgress() };
  contribute(value, estimate, hasEstimate, completed, count);
  map.set(id, value);
}
export async function moduleProgressTotals(ctx: QueryCtx, module: Doc<"modules">, project: Doc<"projects">) {
  const namespace = [module._id, "api_metrics"] satisfies Parameters<typeof taskCollection.count>[1]["namespace"];
  const scopes = [
    ...stateApiGroup.options
      .filter((group) => group !== "triage")
      .map(
        (group) =>
          ({ namespace, bounds: { prefix: [false, group, true] } }) satisfies Parameters<typeof taskCollection.count>[1]
      ),
    { namespace, bounds: { prefix: [true, null, true] } } satisfies Parameters<typeof taskCollection.count>[1],
  ];
  const scopeCounts = await taskCollection.countBatch(ctx, scopes);
  const statuses = new Map<string | null, Bucket>();
  const totals = emptyProgress();
  /* oxlint-disable no-await-in-loop */
  for (const [scopeIndex, scope] of scopes.entries()) {
    for (let offset = 0; offset < scopeCounts[scopeIndex]; ) {
      const item = await taskCollection.at(ctx, offset, scope);
      const task = await ctx.db.get(item.id);
      if (
        !task ||
        task.projectId !== project._id ||
        task.workspaceId !== project.workspaceId ||
        task.deletedAt !== null ||
        task.archivedAt !== null ||
        compareValues(item.key, taskModuleApiEntry(task, module._id).key) !== 0 ||
        !(await ctx.db
          .query("moduleTasks")
          .withIndex("by_module_task", (q) => q.eq("moduleId", module._id).eq("taskId", task._id))
          .unique())
      )
        throw new ConvexError({ status: 503, detail: "Task collection index requires reconciliation." });
      // A missing State FK retains native status; triage contributes to the skip count, not native progress.
      const states = task.stateId === null ? status.members.map(({ value }) => value) : [task.status];
      const [count, ...buckets] = await taskCollection.countBatch(ctx, [
        {
          namespace,
          bounds: { prefix: [scope.bounds.prefix[0], scope.bounds.prefix[1], true, task.estimatePointId] },
        },
        ...states.flatMap((value) =>
          [false, true].map(
            (completed) =>
              ({
                namespace,
                bounds: {
                  eq: [scope.bounds.prefix[0], scope.bounds.prefix[1], true, task.estimatePointId, completed, value],
                },
              }) satisfies Parameters<typeof taskCollection.count>[1]
          )
        ),
      ]);
      const estimate = await numericTaskEstimate(ctx, task);
      const hasEstimate = task.estimatePointId !== null;
      for (const [stateIndex, state] of states.entries()) {
        contribute(totals, estimate, hasEstimate, false, buckets[stateIndex * 2]);
        contribute(totals, estimate, hasEstimate, true, buckets[stateIndex * 2 + 1]);
        add(statuses, state, state, estimate, hasEstimate, false, buckets[stateIndex * 2]);
        add(statuses, state, state, estimate, hasEstimate, true, buckets[stateIndex * 2 + 1]);
      }
      offset += count;
    }
  }
  /* oxlint-enable no-await-in-loop */
  return { ...totals, statuses: [...statuses.values()] };
}
export async function progressTotals(
  ctx: QueryCtx,
  tasks: Doc<"tasks">[],
  viewerWorkspaceRole: Doc<"workspaceMembers">["role"]
) {
  const statuses = new Map<string | null, Bucket>(),
    assignees = new Map<string | null, Bucket>(),
    labels = new Map<string | null, Bucket>();
  const totals = emptyProgress();
  await Promise.all(
    tasks.map(async (task) => {
      const estimate = await numericTaskEstimate(ctx, task);
      const completed = task.completedAt !== null;
      contribute(totals, estimate, task.estimatePointId !== null, completed);
      add(statuses, task.status, task.status, estimate, task.estimatePointId !== null, completed);
      if (!task.assigneeIds.length)
        add(assignees, null, "Unassigned", estimate, task.estimatePointId !== null, completed);
      await Promise.all(
        task.assigneeIds.map(async (id) => {
          const identity = await memberIdentity(ctx, task.workspaceId, viewerWorkspaceRole, id, "");
          add(
            assignees,
            id,
            memberLabel(
              identity ? { id, name: identity.fullName || identity.displayName, email: identity.email } : null
            ),
            estimate,
            task.estimatePointId !== null,
            completed
          );
        })
      );
      if (!task.labelIds.length) add(labels, null, "No label", estimate, task.estimatePointId !== null, completed);
      await Promise.all(
        task.labelIds.map(async (id) => {
          const label = await ctx.db.get(id);
          const name =
            label?.projectId === task.projectId && label.workspaceId === task.workspaceId
              ? label.name
              : "Unavailable label";
          add(labels, id, name, estimate, task.estimatePointId !== null, completed);
        })
      );
    })
  );
  return {
    ...totals,
    statuses: [...statuses.values()],
    assignees: [...assignees.values()],
    labels: [...labels.values()],
  };
}

export async function numericTaskEstimate(ctx: QueryCtx, task: Doc<"tasks">) {
  const point = task.estimatePointId ? await ctx.db.get(task.estimatePointId) : null;
  const system = point ? await ctx.db.get(point.systemId) : null;
  const numeric =
    point &&
    point.projectId === task.projectId &&
    system?.projectId === task.projectId &&
    system.workspaceId === task.workspaceId &&
    system.type === "points" &&
    /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(point.value.trim())
      ? Number(point.value)
      : null;
  return numeric !== null && Number.isFinite(numeric) ? numeric : null;
}
