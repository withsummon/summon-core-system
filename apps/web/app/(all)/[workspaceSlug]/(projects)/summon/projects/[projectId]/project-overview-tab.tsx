import Link from "next/link";
import { Activity, CalendarDays, Gauge, ListChecks, ShieldCheck } from "lucide-react";
import { useEffect } from "react";
import { usePaginatedQuery } from "convex-helpers/react";
import type { FunctionReturnType } from "convex/server";
import type { Id } from "@summon/convex/data-model";
import { api } from "@summon/convex/api";
import { MilestoneCompletion } from "./project-detail-tabs";

const formatDate = (value?: string | null) =>
  value
    ? new Intl.DateTimeFormat("en", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value))
    : "Not set";

export function ProjectOverviewTab(props: {
  overview: FunctionReturnType<typeof api.reporting.overview.project>;
  workspaceSlug: string;
  projectId: Id<"projects">;
}) {
  const { overview, workspaceSlug, projectId } = props;
  const tasks = usePaginatedQuery(api.tasks.index.list, { projectId }, { initialNumItems: 100 });
  const modules = usePaginatedQuery(api.modules.index.list, { projectId, deleted: false }, { initialNumItems: 100 });
  const cycles = usePaginatedQuery(api.cycles.index.list, { projectId, deleted: false }, { initialNumItems: 100 });
  const resources = usePaginatedQuery(api.reporting.overview.resources, { projectId }, { initialNumItems: 20 });
  const activity = usePaginatedQuery(api.reporting.overview.activity, { projectId }, { initialNumItems: 20 });
  const { status: tasksStatus, loadMore: loadTasks } = tasks;
  useEffect(() => {
    if (tasksStatus === "CanLoadMore") loadTasks(100);
  }, [tasksStatus, loadTasks]);
  const { status: modulesStatus, loadMore: loadModules } = modules;
  useEffect(() => {
    if (modulesStatus === "CanLoadMore") loadModules(100);
  }, [modulesStatus, loadModules]);
  const { status: cyclesStatus, loadMore: loadCycles } = cycles;
  useEffect(() => {
    if (cyclesStatus === "CanLoadMore") loadCycles(100);
  }, [cyclesStatus, loadCycles]);
  const { status: resourcesStatus, loadMore: loadResources } = resources;
  const resourcesCount = resources.results.length;
  useEffect(() => {
    if (resourcesStatus === "CanLoadMore" && resourcesCount < 6) loadResources(20);
  }, [resourcesStatus, resourcesCount, loadResources]);
  const { status: activityStatus, loadMore: loadActivity } = activity;
  const activityCount = activity.results.length;
  useEffect(() => {
    if (activityStatus === "CanLoadMore" && activityCount < 6) loadActivity(20);
  }, [activityStatus, activityCount, loadActivity]);
  const completedIssues = tasks.results.filter((task) => task.status === "done");
  const openIssues = tasks.results.filter((task) => task.status !== "done" && task.status !== "cancelled");
  const today = new Date().toLocaleDateString("en-CA");
  const overdue = openIssues.filter((task) => task.targetDate && task.targetDate < today).length;
  const total = tasks.results.length;
  const complete = tasks.status === "Exhausted";
  const milestoneModules = modules.results.filter((row) => !row.archived);
  const milestoneCycles = cycles.results.filter((row) => !row.archived);
  const nextMilestone = milestoneModules[0] ?? milestoneCycles[0];
  const milestonesReady = modules.status === "Exhausted" && cycles.status === "Exhausted";

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          label="Overall Progress"
          value={`${total ? Math.round((completedIssues.length * 100) / total) : 0}%`}
          loading={!complete}
          detail={`${completedIssues.length} of ${total} completed`}
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
          value={nextMilestone?.name || "Not set"}
          loading={!milestonesReady}
          detail={"Project milestones"}
          icon={CalendarDays}
        />
        <Metric
          label="Open Tasks"
          value={String(openIssues.length)}
          loading={!complete}
          detail={overdue ? `${overdue} overdue` : "No overdue tasks"}
          icon={ListChecks}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Panel title="Project Timeline">
          <div className="space-y-3">
            {milestoneModules.slice(0, 6).map((milestone) => (
              <Link
                key={milestone._id}
                href={`/${workspaceSlug}/projects/${projectId}/modules/${milestone._id}/`}
                className="flex items-center gap-3 rounded-xl border border-subtle p-3 hover:bg-layer-1"
              >
                <span className="size-2.5 shrink-0 rounded-full bg-accent-primary" />
                <span className="min-w-0 flex-1">
                  <strong className="text-xs block truncate font-medium text-primary">{milestone.name}</strong>
                  <small className="text-[10px] text-secondary">{formatDate(milestone.targetDate)}</small>
                </span>
                <span className="text-[10px] text-secondary">
                  <MilestoneCompletion moduleId={milestone._id} />
                </span>
              </Link>
            ))}
            {milestoneCycles.slice(0, 6).map((milestone) => (
              <Link
                key={milestone._id}
                href={`/${workspaceSlug}/projects/${projectId}/cycles/${milestone._id}/`}
                className="flex items-center gap-3 rounded-xl border border-subtle p-3 hover:bg-layer-1"
              >
                <span className="size-2.5 shrink-0 rounded-full bg-accent-primary" />
                <span className="min-w-0 flex-1">
                  <strong className="text-xs block truncate font-medium text-primary">{milestone.name}</strong>
                  <small className="text-[10px] text-secondary">{formatDate(milestone.endDate)}</small>
                </span>
                <span className="text-[10px] text-secondary">
                  <MilestoneCompletion cycleId={milestone._id} />
                </span>
              </Link>
            ))}
            <Empty
              count={milestoneModules.length + milestoneCycles.length}
              pending={!milestonesReady}
              text="No milestones yet."
            />
          </div>
        </Panel>

        <Panel title="Tasks Overview" href={`/${workspaceSlug}/projects/${projectId}/issues/`}>
          <div className="grid grid-cols-2 gap-2">
            <Stat label="Total" value={total} loading={!complete} />
            <Stat label="Completed" value={completedIssues.length} loading={!complete} />
            <Stat label="Open" value={openIssues.length} loading={!complete} />
            <Stat label="Overdue" value={overdue} loading={!complete} />
          </div>
        </Panel>

        <Panel title="Latest Activity">
          <div className="divide-y divide-subtle">
            {activity.results.slice(0, 6).map((item) => (
              <Link
                key={item._id}
                href={`/${workspaceSlug}/projects/${projectId}/issues/${item.taskId}/`}
                className="flex gap-3 py-2.5 first:pt-0"
              >
                <Activity className="size-4 shrink-0 text-accent-primary" />
                <span className="min-w-0">
                  <strong className="text-xs block truncate font-medium text-primary">
                    {item.title} · {item.kind.replaceAll("_", " ")}
                  </strong>
                  <small className="text-[10px] text-secondary">{new Date(item.at).toLocaleDateString()}</small>
                </span>
              </Link>
            ))}
            <Empty
              count={activity.results.length}
              pending={activity.status !== "Exhausted"}
              text="No recent activity."
            />
          </div>
        </Panel>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Panel title="Quick Access">
          <div className="grid gap-2 sm:grid-cols-2">
            {resources.results.slice(0, 6).map((resource) => (
              <a
                key={resource._id}
                href={resource.url}
                target="_blank"
                rel="noreferrer"
                className="truncate rounded-xl border border-subtle p-3 text-[11px] text-primary hover:bg-layer-1"
              >
                {resource.title}
              </a>
            ))}
            <Empty
              count={resources.results.length}
              pending={resources.status !== "Exhausted"}
              text="No resources linked."
            />
          </div>
        </Panel>
        <TeamMembers projectId={projectId} workspaceSlug={workspaceSlug} />
        <Panel title="Project Health">
          <div className="rounded-xl bg-success-subtle p-4">
            <p className="text-[10px] text-secondary">Overall health</p>
            <p className="text-sm mt-1 font-semibold text-success-primary">
              {overview.profile?.health.replaceAll("_", " ") || "Not set"}
            </p>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Stat label="Schedule" value={overdue ? "Needs attention" : "On track"} loading={!complete} />
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
  loading,
}: {
  label: string;
  value: string;
  detail: string;
  icon: typeof Gauge;
  loading?: boolean;
}) {
  return (
    <section className="shadow-xs rounded-2xl border border-subtle bg-surface-1 p-4">
      <div className="flex items-center gap-2 text-[10px] text-secondary">
        <Icon className="size-4 text-accent-primary" />
        {label}
      </div>
      <strong className="text-xl mt-4 block truncate font-semibold text-primary">{loading ? "…" : value}</strong>
      <p className="mt-1 truncate text-[10px] text-tertiary">{loading ? "Loading…" : detail}</p>
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

function Stat({ label, value, loading }: { label: string; value: React.ReactNode; loading?: boolean }) {
  return (
    <div className="rounded-xl bg-layer-1 p-3">
      <span className="text-[10px] text-secondary">{label}</span>
      <strong className="text-xs mt-1 block truncate font-medium text-primary">{loading ? "…" : value}</strong>
    </div>
  );
}

function Empty({ text, count, pending }: { text: string; count: number; pending: boolean }) {
  return count ? null : (
    <p
      role={pending ? "status" : undefined}
      className="text-xs col-span-full rounded-xl border border-dashed border-subtle p-4 text-center text-tertiary"
    >
      {pending ? "Loading…" : text}
    </p>
  );
}
function TeamMembers({ projectId, workspaceSlug }: { projectId: Id<"projects">; workspaceSlug: string }) {
  const members = usePaginatedQuery(api.projects.directory.members, { projectId }, { initialNumItems: 50 });
  const { status, loadMore } = members;
  const count = members.results.length;
  useEffect(() => {
    if (status === "CanLoadMore" && count < 6) loadMore(50);
  }, [status, loadMore, count]);
  return (
    <Panel title="Team Members" href={`/${workspaceSlug}/settings/projects/${projectId}/members/`}>
      <div className="space-y-2">
        {members.results.slice(0, 6).map((member) => (
          <div key={member.userId} className="text-xs rounded-xl bg-layer-1 px-3 py-2 text-primary">
            {member.name}
          </div>
        ))}
        <Empty count={count} pending={status !== "Exhausted"} text="No accessible member profiles." />
      </div>
    </Panel>
  );
}
