import { v } from "convex/values";
import type { QueryCtx } from "../_generated/server";
import type { Doc } from "../_generated/dataModel";
const totals = { count: v.number(), numericEstimates: v.number(), unquantifiedEstimates: v.number() };
const distribution = v.object({ id: v.union(v.string(), v.null()), name: v.string(), ...totals });
export const transferSnapshot = v.object({
  ...totals,
  statuses: v.array(distribution),
  assignees: v.array(distribution),
  labels: v.array(distribution),
  capturedAt: v.number(),
});
type Totals = { count: number; numericEstimates: number; unquantifiedEstimates: number };
type Bucket = Totals & { id: string | null; name: string };
function add(
  map: Map<string | null, Bucket>,
  id: string | null,
  name: string,
  estimate: number | null,
  hasEstimate: boolean
) {
  const value = map.get(id) ?? { id, name, count: 0, numericEstimates: 0, unquantifiedEstimates: 0 };
  value.count++;
  if (estimate !== null) value.numericEstimates += estimate;
  else if (hasEstimate) value.unquantifiedEstimates++;
  map.set(id, value);
}
export async function snapshot(ctx: QueryCtx, tasks: Doc<"tasks">[]) {
  const statuses = new Map<string | null, Bucket>(),
    assignees = new Map<string | null, Bucket>(),
    labels = new Map<string | null, Bucket>();
  let numericEstimates = 0,
    unquantifiedEstimates = 0;
  await Promise.all(
    tasks.map(async (task) => {
      const point = task.estimatePointId ? await ctx.db.get(task.estimatePointId) : null;
      const system = point ? await ctx.db.get(point.systemId) : null;
      const numeric =
        point && system?.type === "points" && /^\d+(?:\.\d+)?$/.test(point.value.trim()) ? Number(point.value) : null;
      const estimate = numeric !== null && Number.isFinite(numeric) ? numeric : null;
      if (estimate !== null) numericEstimates += estimate;
      else if (task.estimatePointId) unquantifiedEstimates++;
      add(statuses, task.status, task.status, estimate, task.estimatePointId !== null);
      if (!task.assigneeIds.length) add(assignees, null, "Unassigned", estimate, task.estimatePointId !== null);
      await Promise.all(
        task.assigneeIds.map(async (id) => {
          const user = await ctx.db.get(id);
          add(assignees, id, user?.name ?? "Unnamed member", estimate, task.estimatePointId !== null);
        })
      );
      if (!task.labelIds.length) add(labels, null, "No label", estimate, task.estimatePointId !== null);
      await Promise.all(
        task.labelIds.map(async (id) => {
          const label = await ctx.db.get(id);
          add(labels, id, label?.name ?? "Unavailable label", estimate, task.estimatePointId !== null);
        })
      );
    })
  );
  return {
    count: tasks.length,
    numericEstimates,
    unquantifiedEstimates,
    statuses: [...statuses.values()],
    assignees: [...assignees.values()],
    labels: [...labels.values()],
    capturedAt: Date.now(),
  };
}
