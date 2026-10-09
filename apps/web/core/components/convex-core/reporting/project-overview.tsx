import { useQuery } from "convex/react";
import { api } from "@summon/convex/api";
import type { Id } from "@summon/convex/data-model";
export function ProjectOverview({ projectId }: { projectId: Id<"projects"> }) {
  const overview = useQuery(api.reporting.overview.project, { projectId });
  if (!overview) return <p role="status">Loading project overview…</p>;
  return (
    <section className="rounded-xl border border-subtle-1 p-4" aria-labelledby="project-overview-heading">
      <h2 id="project-overview-heading" className="font-semibold">
        Project overview
      </h2>
      {overview.profile ? (
        <dl className="mt-4 grid gap-4 sm:grid-cols-3">
          <div>
            <dt className="text-12 text-secondary">Delivery</dt>
            <dd className="mt-1 capitalize">{overview.profile.deliveryStatus.replaceAll("_", " ")}</dd>
          </div>
          <div>
            <dt className="text-12 text-secondary">Health</dt>
            <dd className="mt-1 capitalize">{overview.profile.health.replaceAll("_", " ")}</dd>
          </div>
          <div>
            <dt className="text-12 text-secondary">Target</dt>
            <dd className="mt-1">{overview.profile.targetDate ?? "Not set"}</dd>
          </div>
        </dl>
      ) : (
        <p className="mt-2 text-14 text-secondary">Delivery profile not set.</p>
      )}
      <p className="mt-4 text-14 text-secondary">
        {overview.recentTasks.length} recent tasks loaded. Open Reports for complete task counts.
      </p>
    </section>
  );
}
