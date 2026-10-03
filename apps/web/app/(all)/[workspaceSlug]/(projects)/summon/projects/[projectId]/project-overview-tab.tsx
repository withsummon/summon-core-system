import Link from "next/link";
import { Activity, CalendarDays, Gauge, ListChecks, ShieldCheck } from "lucide-react";
import type { ISummonProjectOverview } from "@plane/types";

const formatDate = (value?: string | null) =>
  value
    ? new Intl.DateTimeFormat("en", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value))
    : "Not set";

export function ProjectOverviewTab(props: {
  overview: ISummonProjectOverview;
  workspaceSlug: string;
  projectId: string;
  members: { id: string; name: string }[];
}) {
  const { overview, workspaceSlug, projectId, members } = props;
  const openIssues = overview.issues.filter((issue) => !issue.completed);
  const completedIssues = overview.issues.filter((issue) => issue.completed);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          label="Overall Progress"
          value={`${overview.progress.percentage}%`}
          detail={`${overview.progress.completed} of ${overview.progress.total} completed`}
          icon={Gauge}
        />
        <Metric
          label="Current Phase"
          value={overview.profile?.phase || "Not set"}
          detail="Project profile"
          icon={ShieldCheck}
        />
        <Metric
          label="Next Milestone"
          value={overview.milestones[0]?.name || "Not set"}
          detail={formatDate(overview.milestones[0]?.target_date)}
          icon={CalendarDays}
        />
        <Metric
          label="Open Tasks"
          value={String(openIssues.length)}
          detail={overview.progress.overdue ? `${overview.progress.overdue} overdue` : "No overdue tasks"}
          icon={ListChecks}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Panel title="Project Timeline">
          <div className="space-y-3">
            {overview.milestones.slice(0, 6).map((milestone) => (
              <Link
                key={milestone.id}
                href={milestone.href}
                className="flex items-center gap-3 rounded-xl border border-subtle p-3 hover:bg-layer-1"
              >
                <span className="size-2.5 shrink-0 rounded-full bg-accent-primary" />
                <span className="min-w-0 flex-1">
                  <strong className="text-xs block truncate font-medium text-primary">{milestone.name}</strong>
                  <small className="text-[10px] text-secondary">{formatDate(milestone.target_date)}</small>
                </span>
                <span className="text-[10px] text-secondary">{milestone.completion}%</span>
              </Link>
            ))}
            {!overview.milestones.length && <Empty text="No milestones yet." />}
          </div>
        </Panel>

        <Panel title="Tasks Overview" href={`/${workspaceSlug}/projects/${projectId}/issues/`}>
          <div className="grid grid-cols-2 gap-2">
            <Stat label="Total" value={overview.progress.total} />
            <Stat label="Completed" value={completedIssues.length} />
            <Stat label="Open" value={openIssues.length} />
            <Stat label="Overdue" value={overview.progress.overdue} />
          </div>
        </Panel>

        <Panel title="Latest Activity">
          <div className="divide-y divide-subtle">
            {overview.activity.slice(0, 6).map((item) => (
              <Link key={item.id} href={item.href} className="flex gap-3 py-2.5 first:pt-0">
                <Activity className="size-4 shrink-0 text-accent-primary" />
                <span className="min-w-0">
                  <strong className="text-xs block truncate font-medium text-primary">{item.label}</strong>
                  <small className="text-[10px] text-secondary">{formatDate(item.created_at)}</small>
                </span>
              </Link>
            ))}
            {!overview.activity.length && <Empty text="No recent activity." />}
          </div>
        </Panel>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Panel title="Quick Access">
          <div className="grid gap-2 sm:grid-cols-2">
            {overview.resources.slice(0, 6).map((resource) => (
              <a
                key={resource.id}
                href={resource.url}
                target="_blank"
                rel="noreferrer"
                className="truncate rounded-xl border border-subtle p-3 text-[11px] text-primary hover:bg-layer-1"
              >
                {resource.title}
              </a>
            ))}
            {!overview.resources.length && <Empty text="No resources linked." />}
          </div>
        </Panel>
        <Panel title="Team Members" href={`/${workspaceSlug}/settings/projects/${projectId}/members/`}>
          <div className="space-y-2">
            {members.slice(0, 6).map((member) => (
              <div key={member.id} className="text-xs rounded-xl bg-layer-1 px-3 py-2 text-primary">
                {member.name}
              </div>
            ))}
            {!members.length && <Empty text="No accessible member profiles." />}
          </div>
        </Panel>
        <Panel title="Project Health">
          <div className="rounded-xl bg-success-subtle p-4">
            <p className="text-[10px] text-secondary">Overall health</p>
            <p className="text-sm mt-1 font-semibold text-success-primary">
              {overview.profile?.health?.replaceAll("_", " ") || "Not set"}
            </p>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Stat label="Schedule" value={overview.progress.overdue ? "Needs attention" : "On track"} />
            <Stat label="Budget" value={overview.profile?.budget || "Not set"} />
          </div>
        </Panel>
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  detail,
  icon: Icon,
}: {
  label: string;
  value: string;
  detail: string;
  icon: typeof Gauge;
}) {
  return (
    <section className="shadow-xs rounded-2xl border border-subtle bg-surface-1 p-4">
      <div className="flex items-center gap-2 text-[10px] text-secondary">
        <Icon className="size-4 text-accent-primary" />
        {label}
      </div>
      <strong className="text-xl mt-4 block truncate font-semibold text-primary">{value}</strong>
      <p className="mt-1 truncate text-[10px] text-tertiary">{detail}</p>
    </section>
  );
}

function Panel({ title, href, children }: { title: string; href?: string; children: React.ReactNode }) {
  return (
    <section className="shadow-xs min-w-0 rounded-2xl border border-subtle bg-surface-1 p-4">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xs font-semibold text-primary">{title}</h2>
        {href && (
          <Link href={href} className="text-[10px] text-accent-primary">
            Manage all
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-layer-1 p-3">
      <span className="text-[10px] text-secondary">{label}</span>
      <strong className="text-xs mt-1 block truncate font-medium text-primary">{value}</strong>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <p className="text-xs col-span-full rounded-xl border border-dashed border-subtle p-4 text-center text-tertiary">
      {text}
    </p>
  );
}
