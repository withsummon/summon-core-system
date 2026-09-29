import { curve } from "./completion_curve";
import { progressTotals } from "../tasks/progress_totals";
import type { QueryCtx } from "../_generated/server";
import type { Doc } from "../_generated/dataModel";
type CurrentProgress = Awaited<ReturnType<typeof progressTotals>>;
function capturedTotals(row: Pick<CurrentProgress, "count" | "numericEstimates" | "unquantifiedEstimates">) {
  return { count: row.count, numericEstimates: row.numericEstimates, unquantifiedEstimates: row.unquantifiedEstimates };
}
function capturedRows(rows: CurrentProgress["labels"]) {
  return rows.map((row) => ({ id: row.id, name: row.name, ...capturedTotals(row) }));
}
export async function snapshot(ctx: QueryCtx, tasks: Doc<"tasks">[], cycle: Doc<"cycles">) {
  const progress = await progressTotals(ctx, tasks);
  // Existing totals stay unchanged; only new snapshots capture a dated curve.
  return {
    ...capturedTotals(progress),
    statuses: capturedRows(progress.statuses),
    assignees: capturedRows(progress.assignees),
    labels: capturedRows(progress.labels),
    capturedAt: Date.now(),
    completionCurve: await curve(ctx, cycle, tasks, Date.now()),
  };
}
