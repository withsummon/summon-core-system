import type { FunctionReturnType } from "convex/server";
import type { api } from "@summon/convex/api";
export type TaskProgress = FunctionReturnType<typeof api.cycles.progress.page>["page"][number];
type Totals = Pick<TaskProgress, "count" | "numericEstimates" | "unquantifiedEstimates">;
type Breakdown = Totals & Pick<TaskProgress, "completed" | "pending">;
function totals(a: Totals, b: Totals): Totals {
  return {
    count: a.count + b.count,
    numericEstimates: a.numericEstimates + b.numericEstimates,
    unquantifiedEstimates: a.unquantifiedEstimates + b.unquantifiedEstimates,
  };
}
function breakdown(a: Breakdown, b: Breakdown): Breakdown {
  return { ...totals(a, b), completed: totals(a.completed, b.completed), pending: totals(a.pending, b.pending) };
}
function combine(pages: TaskProgress[], field: "statuses" | "assignees" | "labels"): TaskProgress["statuses"] {
  const buckets = new Map<string | null, TaskProgress["statuses"][number]>();
  for (const page of pages)
    for (const row of page[field]) {
      const previous = buckets.get(row.id);
      buckets.set(row.id, previous ? { ...row, ...breakdown(previous, row) } : { ...row });
    }
  return [...buckets.values()];
}
export function summarizeTaskProgress(pages: TaskProgress[]): TaskProgress {
  const zero: Totals = { count: 0, numericEstimates: 0, unquantifiedEstimates: 0 };
  const sum = pages.reduce(breakdown, { ...zero, completed: { ...zero }, pending: { ...zero } });
  return {
    ...sum,
    statuses: combine(pages, "statuses"),
    assignees: combine(pages, "assignees"),
    labels: combine(pages, "labels"),
  };
}
