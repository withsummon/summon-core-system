import { Link } from "react-router";
import { usePaginatedQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "@summon/convex/api";
import { cyclePhase } from "@summon/convex/cycle-calendar";
import { Button } from "@plane/propel/button";
import { useCycleClock } from "./use-cycle-clock";
const phases = { draft: "Unscheduled", current: "Current", upcoming: "Upcoming", completed: "Completed" };
export function WorkspaceCycles({
  workspace,
}: {
  workspace: FunctionReturnType<typeof api.workspaces.index.list>[number];
}) {
  const rows = usePaginatedQuery(api.cycles.workspace.list, { workspaceId: workspace._id }, { initialNumItems: 30 });
  const [now] = useCycleClock();
  return (
    <section className="space-y-5">
      <header>
        <p className="text-12 text-secondary">{workspace.name}</p>
        <h1 className="text-28 font-semibold">Workspace cycles</h1>
        <p className="mt-2 text-14 text-secondary">Current, upcoming and completed cycles from your projects.</p>
      </header>
      <ul className="divide-y divide-subtle-1">
        {rows.results.map(({ cycle, project }) => (
          <li key={cycle._id} className="py-4">
            <Link
              to={`/core?${new URLSearchParams({ workspace: workspace.slug, module: "projects", project: project.identifier, projectView: "cycles", cycle: cycle._id })}`}
              className="flex flex-wrap items-start justify-between gap-3 rounded-md p-2 hover:bg-layer-2"
            >
              <div className="min-w-0 space-y-1">
                <p className="text-12 text-secondary">
                  {project.identifier} · {project.name}
                </p>
                <h2 className="text-16 font-medium break-words">{cycle.name}</h2>
                <p className="text-12 text-secondary">
                  {cycle.startDate && cycle.endDate
                    ? `${cycle.startDate} – ${cycle.endDate} · ${cycle.timezone}`
                    : "Dates not set"}
                </p>
              </div>
              <span className="rounded-md bg-layer-2 px-2 py-1 text-12">{phases[cyclePhase(cycle, now)]}</span>
            </Link>
          </li>
        ))}
      </ul>
      {rows.status === "LoadingFirstPage" && <p role="status">Loading workspace cycles…</p>}
      {rows.status === "Exhausted" && !rows.results.length && (
        <div className="py-8">
          <h2 className="text-20 font-medium">No workspace cycles</h2>
          <p className="mt-2 text-14 text-secondary">
            Create a cycle in a project to see it here. Archived and removed cycles stay in their project recovery
            views.
          </p>
        </div>
      )}
      {rows.status === "CanLoadMore" && (
        <div className="space-y-2">
          <p className="text-12 text-secondary">Showing loaded cycles. More may be available.</p>
          <Button variant="secondary" onClick={() => rows.loadMore(30)}>
            Load more cycles
          </Button>
        </div>
      )}
      {rows.status === "LoadingMore" && <p role="status">Loading more cycles…</p>}
    </section>
  );
}
