import { progressTotals } from "../tasks/progress_totals";
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

type CurrentProgress = Awaited<ReturnType<typeof progressTotals>>;
function capturedTotals(row: Pick<CurrentProgress, "count" | "numericEstimates" | "unquantifiedEstimates">) {
  return { count: row.count, numericEstimates: row.numericEstimates, unquantifiedEstimates: row.unquantifiedEstimates };
}
function capturedRows(rows: CurrentProgress["labels"]) {
  return rows.map((row) => ({ id: row.id, name: row.name, ...capturedTotals(row) }));
}
export async function snapshot(ctx: QueryCtx, tasks: Doc<"tasks">[]) {
  const progress = await progressTotals(ctx, tasks);
  // The persisted transfer snapshot intentionally retains its original schema.
  return {
    ...capturedTotals(progress),
    statuses: capturedRows(progress.statuses),
    assignees: capturedRows(progress.assignees),
    labels: capturedRows(progress.labels),
    capturedAt: Date.now(),
  };
}
