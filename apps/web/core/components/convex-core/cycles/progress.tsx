import { usePaginatedQuery } from "convex/react";
import { api } from "@summon/convex/api";
import type { Id } from "@summon/convex/data-model";
import { Button } from "@plane/propel/button";
import { Distribution } from "./distribution";
import { summarizeCycleProgress } from "./progress-summary";
export function CycleProgress({ cycleId }: { cycleId: Id<"cycles"> }) {
  const { results, status, loadMore } = usePaginatedQuery(
    api.cycles.progress.page,
    { cycleId },
    { initialNumItems: 20 }
  );
  const summary = summarizeCycleProgress(results);
  const complete = status === "Exhausted";
  return (
    <section className="min-w-0 space-y-4 rounded-lg border border-subtle-1 p-4" aria-label="Current cycle progress">
      <header>
        <h3 className="text-18 font-semibold">Current progress</h3>
        <p role="status" className="mt-1 text-14 text-secondary">
          {status === "LoadingFirstPage"
            ? "Loading progress…"
            : complete
              ? "All currently visible cycle tasks loaded."
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
        Active tasks you can access. Each person and label receives the task’s contribution, so those totals can
        overlap. Pages update live and may reflect changes at different moments. Transfer snapshots, when available,
        remain historical.
      </p>
    </section>
  );
}
