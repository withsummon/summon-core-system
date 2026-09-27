import type { usePaginatedQuery } from "convex/react";
import type { api } from "@summon/convex/api";
import { Button } from "@plane/propel/button";
import { Distribution } from "./distribution";
import { summarizeTaskProgress } from "./summary";
type ProgressQuery = ReturnType<typeof usePaginatedQuery<typeof api.cycles.progress.page>>;
export function TaskProgressPanel({
  progress: { results, status, loadMore },
  scope,
}: {
  progress: ProgressQuery;
  scope: "cycle" | "module";
}) {
  const summary = summarizeTaskProgress(results);
  const complete = status === "Exhausted";
  return (
    <section
      className="min-w-0 space-y-4 rounded-lg border border-subtle-1 p-4"
      aria-label={`Current ${scope} progress`}
    >
      <header>
        <h3 className="text-18 font-semibold">Current progress</h3>
        <p role="status" className="mt-1 text-14 text-secondary">
          {status === "LoadingFirstPage"
            ? "Loading progress…"
            : complete
              ? `All currently visible ${scope} tasks loaded.`
              : "Partial results · load the remaining pages for full coverage."}
        </p>
      </header>
      {status !== "LoadingFirstPage" && (
        <>
          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <div>
              <dt className="text-12 text-secondary">{complete ? "Visible tasks" : "Loaded tasks"}</dt>
              <dd className="text-24 font-semibold tabular-nums">{summary.count}</dd>
            </div>
            <div>
              <dt className="text-12 text-secondary">Numeric estimates</dt>
              <dd className="text-24 font-semibold tabular-nums">{summary.numericEstimates}</dd>
            </div>
            <div>
              <dt className="text-12 text-secondary">Nonnumeric estimates</dt>
              <dd className="text-24 font-semibold tabular-nums">{summary.unquantifiedEstimates}</dd>
            </div>
          </dl>
          <div className="grid min-w-0 gap-4 lg:grid-cols-3">
            <Distribution kind="statuses" rows={summary.statuses} />
            <Distribution kind="assignees" rows={summary.assignees} />
            <Distribution kind="labels" rows={summary.labels} />
          </div>
        </>
      )}
      {status !== "Exhausted" && (
        <Button
          variant="secondary"
          disabled={status !== "CanLoadMore"}
          loading={status === "LoadingMore"}
          onClick={() => loadMore(20)}
        >
          Load more progress
        </Button>
      )}
      <p className="text-12 text-secondary">
        Includes active tasks you can access. Tasks with multiple assignees or labels count in each group. Pending means
        no completion date.
      </p>
    </section>
  );
}
