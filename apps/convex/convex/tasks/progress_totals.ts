import { memberLabel } from "../../shared/member-label";
import { ConvexError } from "convex/values";
import type { PaginationOptions } from "convex/server";
import type { QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { taskCanRead, taskIsActive } from "./access";

export function progressPageBudget(options: PaginationOptions) {
  if (!Number.isSafeInteger(options.numItems) || options.numItems < 1 || options.numItems > 20)
    throw new ConvexError("Request 1–20 memberships per progress page.");
  return { ...options, maximumRowsRead: 20, maximumBytesRead: 1_048_576 };
}
export async function currentProgress(
  ctx: QueryCtx,
  taskIds: Id<"tasks">[],
  project: Doc<"projects">,
  userId: Id<"users">
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
    tasks.filter((task) => task !== null)
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
function tally(value: Totals, estimate: number | null, hasEstimate: boolean) {
  value.count++;
  if (estimate !== null) value.numericEstimates += estimate;
  else if (hasEstimate) value.unquantifiedEstimates++;
}
function contribute(value: ProgressTotals, estimate: number | null, hasEstimate: boolean, completed: boolean) {
  tally(value, estimate, hasEstimate);
  tally(completed ? value.completed : value.pending, estimate, hasEstimate);
}
function add(
  map: Map<string | null, Bucket>,
  id: string | null,
  name: string,
  estimate: number | null,
  hasEstimate: boolean,
  completed: boolean
) {
  const value = map.get(id) ?? { id, name, ...emptyProgress() };
  contribute(value, estimate, hasEstimate, completed);
  map.set(id, value);
}
export async function progressTotals(ctx: QueryCtx, tasks: Doc<"tasks">[]) {
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
          const user = await ctx.db.get(id);
          add(
            assignees,
            id,
            memberLabel(user ? { id: user._id, name: user.name ?? null, email: user.email ?? null } : null),
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
