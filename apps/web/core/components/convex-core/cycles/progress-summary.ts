import type { FunctionReturnType } from "convex/server";
import type { api } from "@summon/convex/api";
export type CycleProgress = FunctionReturnType<typeof api.cycles.progress.page>["page"][number];
type Distribution = CycleProgress["statuses"];
function combine(pages: CycleProgress[], field: "statuses" | "assignees" | "labels"): Distribution {
  const buckets = new Map<string | null, Distribution[number]>();
  for (const page of pages)
    for (const row of page[field]) {
      const previous = buckets.get(row.id);
      buckets.set(row.id, {
        ...row,
        count: (previous?.count ?? 0) + row.count,
        numericEstimates: (previous?.numericEstimates ?? 0) + row.numericEstimates,
        unquantifiedEstimates: (previous?.unquantifiedEstimates ?? 0) + row.unquantifiedEstimates,
      });
    }
  return [...buckets.values()];
}
export function summarizeCycleProgress(pages: CycleProgress[]): CycleProgress {
  return {
    count: pages.reduce((sum, page) => sum + page.count, 0),
    numericEstimates: pages.reduce((sum, page) => sum + page.numericEstimates, 0),
    unquantifiedEstimates: pages.reduce((sum, page) => sum + page.unquantifiedEstimates, 0),
    statuses: combine(pages, "statuses"),
    assignees: combine(pages, "assignees"),
    labels: combine(pages, "labels"),
  };
}
