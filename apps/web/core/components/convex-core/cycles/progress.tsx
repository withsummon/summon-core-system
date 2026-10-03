import { useState } from "react";
import { usePaginatedQuery } from "convex-helpers/react";
import { api } from "@summon/convex/api";
import type { Id } from "@summon/convex/data-model";
import { Button } from "@plane/propel/button";
import { AreaChart } from "@plane/propel/charts/area-chart";
import { CircularProgressIndicator } from "@plane/ui";
import type { TChartData } from "@plane/types";
import { SingleProgressStats } from "@/components/core/sidebar/single-progress-stats";
import { summarizeTaskProgress } from "../tasks/progress/summary";
import type { TaskProgress } from "../tasks/progress/summary";
import { taskStatusOptions } from "../tasks/options";

const groups = [
  { value: "assignees", label: "Assignees" },
  { value: "labels", label: "Labels" },
  { value: "statuses", label: "States" },
] as const satisfies { value: keyof Pick<TaskProgress, "assignees" | "labels" | "statuses">; label: string }[];

export function CycleProgress({
  cycleId,
  layout = "sidebar",
}: {
  cycleId: Id<"cycles">;
  layout?: "sidebar" | "active";
}) {
  const progress = usePaginatedQuery(api.cycles.progress.page, { cycleId }, { initialNumItems: 20 });
  const [group, setGroup] = useState<(typeof groups)[number]["value"]>("assignees");
  const [points, setPoints] = useState(false);
  const summary = summarizeTaskProgress(progress.results);
  const complete = progress.status === "Exhausted";
  const total = points ? summary.numericEstimates : summary.count;
  const done = points ? summary.completed.numericEstimates : summary.completed.count;
  const percent = total === 0 ? 0 : Math.round((done / total) * 100);
  return (
    <section
      className={
        layout === "active"
          ? "grid grid-cols-1 gap-3 px-5 pt-3 pb-6 lg:grid-cols-2 xl:grid-cols-3"
          : "space-y-4 border-t border-subtle pt-4"
      }
      aria-label="Cycle progress"
    >
      <div
        className={layout === "active" ? "min-h-68 space-y-4 rounded-lg border border-subtle px-3.5 py-4" : "space-y-4"}
      >
        <header className="flex items-center justify-between gap-2">
          <h3 className="text-13 font-medium">Progress</h3>
          <Button size="sm" variant="ghost" aria-pressed={points} onClick={() => setPoints(!points)}>
            {points ? "Points" : "Work items"}
          </Button>
        </header>
        <div className="flex items-center gap-4">
          {complete ? (
            <CircularProgressIndicator size={48} percentage={percent} strokeWidth={4}>
              <span className="text-11">{percent}%</span>
            </CircularProgressIndicator>
          ) : (
            <span role="status" className="text-12 text-secondary">
              Partial progress
            </span>
          )}
          <div>
            <p className="text-14 font-medium">
              {done}/{total} {points ? "points" : "work items"}
            </p>
            {!complete && <p className="text-11 text-secondary">Loaded work items</p>}
          </div>
        </div>
        {points && summary.unquantifiedEstimates > 0 && (
          <p className="text-11 text-secondary">
            {summary.unquantifiedEstimates} work items have nonnumeric estimates.
          </p>
        )}
        {progress.status !== "Exhausted" && (
          <Button
            variant="secondary"
            size="sm"
            disabled={progress.status !== "CanLoadMore"}
            loading={progress.status === "LoadingMore"}
            onClick={() => progress.loadMore(20)}
          >
            Load more progress
          </Button>
        )}
      </div>
      <div className={layout === "active" ? "min-h-68 rounded-lg border border-subtle px-3.5 py-4" : ""}>
        <CycleBurndown cycleId={cycleId} points={points} />
      </div>
      <div className={layout === "active" ? "min-h-68 rounded-lg border border-subtle px-3.5 py-4" : ""}>
        <nav aria-label="Progress distribution" className="mb-2 flex gap-2 border-b border-subtle">
          {groups.map(({ value, label }) => (
            <Button
              key={value}
              size="sm"
              variant="ghost"
              aria-pressed={group === value}
              className={group === value ? "rounded-none border-b-2 border-accent-strong" : ""}
              onClick={() => setGroup(value)}
            >
              {label}
            </Button>
          ))}
        </nav>
        <ul>
          {summary[group].map((row) => (
            <li key={row.id ?? "none"}>
              <SingleProgressStats
                title={
                  group === "statuses"
                    ? (Object.values(taskStatusOptions).find((option) => option.value === row.id)?.label ?? row.name)
                    : row.name
                }
                completed={points ? row.completed.numericEstimates : row.completed.count}
                total={points ? row.numericEstimates : row.count}
              />
            </li>
          ))}
        </ul>
        {!summary[group].length && (
          <p className="text-12 text-secondary">No {group === "statuses" ? "states" : group} to show.</p>
        )}
      </div>
    </section>
  );
}

function CycleBurndown({ cycleId, points }: { cycleId: Id<"cycles">; points: boolean }) {
  const [clock] = useState(Date.now);
  const curves = usePaginatedQuery(api.cycles.burndown.page, { cycleId, now: clock }, { initialNumItems: 20 });
  const first = curves.results[0];
  if (!first)
    return (
      <p role="status" className="text-12 text-secondary">
        Loading burndown…
      </p>
    );
  if (!first.startDate || !first.endDate)
    return <p className="text-12 text-secondary">Set cycle dates to see the burndown.</p>;
  const buckets = new Map<string, number>();
  let total = 0;
  for (const page of curves.results) {
    total += points ? page.points : page.count;
    for (const row of page.completed)
      buckets.set(row.day, (buckets.get(row.day) ?? 0) + (points ? row.points : row.count));
  }
  const startDate = first.startDate,
    endDate = first.endDate;
  const asOf = first.asOfDay < startDate ? startDate : first.asOfDay > endDate ? endDate : first.asOfDay;
  const days = new Set([
    startDate,
    endDate,
    asOf,
    ...[...buckets.keys()].filter((day) => day >= startDate && day <= endDate),
  ]);
  // Sparse civil-day buckets keep long cycles bounded; ideal progress uses elapsed days.
  const span = Date.parse(endDate) - Date.parse(startDate);
  // ES2022 consumers sort this fresh copy; no caller array is mutated.
  // oxlint-disable-next-line unicorn/no-array-sort
  const data: TChartData<"name", "current" | "ideal">[] = [...days].sort().map((day) => ({
    name: day,
    current:
      day > first.asOfDay
        ? null
        : Math.max(
            0,
            total - [...buckets].filter(([completed]) => completed <= day).reduce((sum, [, count]) => sum + count, 0)
          ),
    ideal: span === 0 ? 0 : total * (1 - (Date.parse(day) - Date.parse(startDate)) / span),
  }));
  return (
    <div className="space-y-2" aria-label="Cycle burndown">
      <h4 className="text-12 font-medium">Burndown</h4>
      <AreaChart
        data={data}
        areas={[
          {
            key: "current",
            label: "Remaining",
            strokeColor: "#3F76FF",
            fill: "#3F76FF33",
            fillOpacity: 1,
            showDot: true,
            smoothCurves: false,
            strokeOpacity: 1,
            stackId: "remaining",
          },
          {
            key: "ideal",
            label: "Ideal",
            strokeColor: "#A9BBD0",
            fill: "#A9BBD0",
            fillOpacity: 0,
            showDot: false,
            smoothCurves: false,
            strokeOpacity: 1,
            stackId: "ideal",
            style: { strokeDasharray: "6, 3" },
          },
        ]}
        xAxis={{ key: "name", label: "Date" }}
        yAxis={{ key: "ideal", label: points ? "Points" : "Work items", allowDecimals: points }}
        className="h-52 w-full"
        margin={{ left: 0, right: 8, bottom: 20 }}
      />
      <p className="text-11 text-secondary">
        Current cycle membership · {first.asOfDay}
        {curves.status === "Exhausted" ? "" : " · Partial results"}
      </p>
      {curves.status === "CanLoadMore" && (
        <Button size="sm" variant="secondary" onClick={() => curves.loadMore(20)}>
          Load more burndown
        </Button>
      )}
      <details className="text-11">
        <summary>Burndown data</summary>
        <table className="w-full">
          <thead>
            <tr>
              <th className="text-left">Date</th>
              <th>Remaining</th>
              <th>Ideal</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row) => (
              <tr key={row.name}>
                <td>{row.name}</td>
                <td className="text-center">{row.current ?? "—"}</td>
                <td className="text-center">{Math.round(row.ideal * 100) / 100}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}
