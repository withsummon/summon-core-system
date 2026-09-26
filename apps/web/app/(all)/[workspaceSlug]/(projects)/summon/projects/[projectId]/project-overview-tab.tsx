import Link from "next/link";
import { Activity, ArrowUpRight, Circle, CheckCircle2, AlertCircle, Flag } from "lucide-react";
import type { ISummonProjectOverview } from "@plane/types";
import { projectHealthLabel } from "@/components/summon/projects/project-workspace";

const formatDate = (value?: string | null) =>
  value
    ? new Intl.DateTimeFormat("en", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value))
    : "No date";

export function ProjectOverviewTab({
  overview,
  workspaceSlug,
  projectId,
  members,
}: {
  overview: ISummonProjectOverview;
  workspaceSlug: string;
  projectId: string;
  members: { id: string; name: string }[];
}) {
  const health = overview.profile?.health || "not_assessed";
  const healthy = health === "on_track" || health === "good";
  const atRisk = ["at_risk", "off_track", "delayed"].includes(health);
  const HealthIcon = healthy ? CheckCircle2 : atRisk ? AlertCircle : Circle;
  return (
    <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_18rem]">
      <div className="min-w-0 space-y-7">
        <section aria-labelledby="project-progress">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id="project-progress" className="text-sm font-semibold text-primary">
              Progress
            </h2>
            <Link
              href={`/${workspaceSlug}/projects/${projectId}/issues/`}
              className="text-xs inline-flex items-center gap-1 rounded text-secondary hover:text-primary focus-visible:outline-2 focus-visible:outline-accent-strong"
            >
              View all tasks <ArrowUpRight aria-hidden="true" className="size-3.5" />
            </Link>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <strong className="text-2xl font-semibold text-primary tabular-nums">
              {overview.progress.percentage}%
            </strong>
            <span className="text-xs text-secondary">
              {overview.progress.completed} of {overview.progress.total} tasks completed
            </span>
          </div>
          <div aria-hidden="true" className="mt-3 h-1.5 overflow-hidden rounded-full bg-layer-2">
            <div
              className="h-full rounded-full bg-accent-primary"
              style={{ width: `${overview.progress.percentage}%` }}
            />
          </div>
          {overview.progress.overdue > 0 && (
            <p className="text-xs mt-3 inline-flex items-center gap-1.5 text-warning-primary">
              <AlertCircle aria-hidden="true" className="size-3.5" />
              {overview.progress.overdue} overdue
            </p>
          )}
        </section>
        <section aria-labelledby="project-milestones" className="border-t border-subtle pt-5">
          <h2 id="project-milestones" className="text-sm mb-3 font-semibold text-primary">
            Milestones
          </h2>
          {overview.milestones.length ? (
            <ul className="divide-y divide-subtle">
              {overview.milestones.slice(0, 6).map((milestone) => (
                <li key={milestone.id}>
                  <Link
                    href={milestone.href}
                    className="flex items-center gap-3 rounded py-3 hover:bg-layer-1 focus-visible:outline-2 focus-visible:outline-accent-strong"
                  >
                    <Flag aria-hidden="true" className="size-4 shrink-0 text-secondary" />
                    <span className="min-w-0 flex-1">
                      <span className="text-sm block break-words text-primary">{milestone.name}</span>
                      <span className="text-xs text-secondary">{formatDate(milestone.target_date)}</span>
                    </span>
                    <span className="text-xs text-secondary tabular-nums">{milestone.completion}%</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-secondary">No milestones yet.</p>
          )}
        </section>
        <section aria-labelledby="project-activity" className="border-t border-subtle pt-5">
          <h2 id="project-activity" className="text-sm mb-3 font-semibold text-primary">
            Latest activity
          </h2>
          {overview.activity.length ? (
            <ul className="divide-y divide-subtle">
              {overview.activity.slice(0, 6).map((item) => (
                <li key={item.id}>
                  <Link
                    href={item.href}
                    className="flex gap-3 rounded py-3 hover:bg-layer-1 focus-visible:outline-2 focus-visible:outline-accent-strong"
                  >
                    <Activity aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-secondary" />
                    <span className="min-w-0">
                      <span className="text-sm block break-words text-primary">{item.label}</span>
                      <span className="text-xs text-secondary">{formatDate(item.created_at)}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-secondary">No recent activity.</p>
          )}
        </section>
      </div>
      <aside className="min-w-0 space-y-6 border-t border-subtle pt-5 xl:border-t-0 xl:border-l xl:pt-0 xl:pl-6">
        <section aria-labelledby="project-properties">
          <h2 id="project-properties" className="text-sm mb-4 font-semibold text-primary">
            Properties
          </h2>
          <dl className="text-xs space-y-4">
            <Property label="Health">
              <span
                className={`inline-flex items-center gap-1.5 ${healthy ? "text-success-primary" : atRisk ? "text-warning-primary" : "text-secondary"}`}
              >
                <HealthIcon aria-hidden="true" className="size-3.5" />
                {projectHealthLabel(health)}
              </span>
            </Property>
            <Property label="Status">
              {projectHealthLabel(overview.profile?.delivery_status || "not_assessed")}
            </Property>
            <Property label="Phase">{overview.profile?.phase || "Not set"}</Property>
            <Property label="Start date">{formatDate(overview.profile?.start_date)}</Property>
            <Property label="Budget">{overview.profile?.budget || "Not set"}</Property>
          </dl>
        </section>
        <section className="border-t border-subtle pt-5" aria-labelledby="project-members">
          <h2 id="project-members" className="text-sm mb-3 font-semibold text-primary">
            Members <span className="text-xs font-normal ml-1 text-secondary tabular-nums">{members.length}</span>
          </h2>
          {members.length ? (
            <ul className="space-y-2.5">
              {members.slice(0, 6).map((member) => (
                <li key={member.id} className="text-xs flex items-center gap-2.5 text-primary">
                  <span
                    aria-hidden="true"
                    className="grid size-6 shrink-0 place-items-center rounded-full bg-layer-2 text-secondary"
                  >
                    {member.name.slice(0, 1).toUpperCase()}
                  </span>
                  <span className="break-words">{member.name}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-secondary">No accessible member profiles.</p>
          )}
        </section>
        <section className="border-t border-subtle pt-5" aria-labelledby="project-links">
          <h2 id="project-links" className="text-sm mb-3 font-semibold text-primary">
            Resources
          </h2>
          {overview.resources.length ? (
            <ul className="space-y-2.5">
              {overview.resources.slice(0, 6).map((resource) => (
                <li key={resource.id}>
                  <a
                    href={resource.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs flex items-center gap-2 rounded text-secondary hover:text-primary focus-visible:outline-2 focus-visible:outline-accent-strong"
                  >
                    <span className="min-w-0 flex-1 break-words">{resource.title}</span>
                    <ArrowUpRight aria-hidden="true" className="size-3.5 shrink-0" />
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-secondary">No resources linked.</p>
          )}
        </section>
      </aside>
    </div>
  );
}

function Property({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[5rem_minmax(0,1fr)] gap-3">
      <dt className="text-secondary">{label}</dt>
      <dd className="break-words text-primary">{children}</dd>
    </div>
  );
}
