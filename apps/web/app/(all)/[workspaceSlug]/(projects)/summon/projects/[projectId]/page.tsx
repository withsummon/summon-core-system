/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import Link from "next/link";
import useSWR from "swr";
import {
  Activity,
  ArrowLeft,
  CalendarDays,
  ChevronRight,
  Circle,
  ExternalLink,
  FileText,
  FolderGit2,
  Gauge,
  LayoutDashboard,
  ListChecks,
  MessageSquareText,
  Settings2,
  ShieldCheck,
  Users,
} from "lucide-react";
import { SummonRequestState } from "@/components/summon/request-state";
import { useMember } from "@/hooks/store/use-member";
import projectMemberService from "@/services/project/project-member.service";
import { summonService } from "@/services/summon.service";
import type { Route } from "./+types/page";

const formatDate = (value?: string | null) => {
  if (!value) return "Not set";
  return new Intl.DateTimeFormat("en", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value));
};

function hasStatus(error: unknown, status: number) {
  if (typeof error !== "object" || error === null || !("response" in error)) return false;
  const { response } = error;
  return typeof response === "object" && response !== null && "status" in response && response.status === status;
}

export default function SummonProjectOverviewPage({ params }: Route.ComponentProps) {
  const { workspaceSlug, projectId } = params;
  const { getUserDetails } = useMember();
  const { data, error, isLoading, mutate } = useSWR(["summon-project-overview", workspaceSlug, projectId], () =>
    summonService.getProjectOverview(workspaceSlug, projectId)
  );
  const { data: memberships = [] } = useSWR(["summon-project-members", workspaceSlug, projectId], () =>
    projectMemberService.fetchProjectMembers(workspaceSlug, projectId)
  );
  const { data: client } = useSWR(
    data?.profile?.client ? ["summon-project-client", workspaceSlug, data.profile.client] : null,
    () => summonService.getClient(workspaceSlug, data?.profile?.client || "")
  );

  if (!data) {
    if (hasStatus(error, 403)) return <SummonRequestState permissionError />;
    if (hasStatus(error, 404))
      return <SummonRequestState validationError="This project is unavailable or you no longer have access." />;
    return <SummonRequestState loading={isLoading} error={error} onRetry={() => void mutate()} />;
  }

  const members = memberships.map((membership) => getUserDetails(membership.member)).filter(Boolean);
  const openIssues = data.issues.filter((issue) => !issue.completed);
  const completedIssues = data.issues.filter((issue) => issue.completed);
  const projectLinks = [
    ["Overview", `/${workspaceSlug}/summon/projects/${projectId}/`, LayoutDashboard],
    ["Tasks", `/${workspaceSlug}/projects/${projectId}/issues/`, ListChecks],
    ["Milestones", `/${workspaceSlug}/projects/${projectId}/modules/`, CalendarDays],
    ["Documents", `/${workspaceSlug}/projects/${projectId}/pages/`, FileText],
    ["Members", `/${workspaceSlug}/settings/projects/${projectId}/members/`, Users],
    ["Meetings", `/${workspaceSlug}/summon/meetings/`, MessageSquareText],
    ["Activity", `/${workspaceSlug}/summon/projects/${projectId}/`, Activity],
  ] as const;

  return (
    <div className="min-h-full bg-surface-1 p-4 lg:p-5">
      <header className="border-b border-subtle pb-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[11px] text-secondary">
              <Link
                href={`/${workspaceSlug}/summon/projects/`}
                className="inline-flex items-center gap-1 hover:text-primary"
              >
                <ArrowLeft className="size-3.5" /> Projects
              </Link>
              <ChevronRight className="size-3" />
              <span className="truncate">{data.project.name}</span>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <span className="text-xs grid size-9 place-items-center rounded-lg bg-accent-subtle font-semibold text-accent-primary">
                {data.project.identifier.slice(0, 2)}
              </span>
              <h1 className="text-2xl font-semibold tracking-tight text-primary">{data.project.name}</h1>
              <span className="rounded-full bg-success-subtle px-2.5 py-1 text-[10px] text-success-primary">
                {data.profile?.delivery_status || "Status not set"}
              </span>
            </div>
            <div className="mt-4 flex flex-wrap gap-x-8 gap-y-2 text-[11px]">
              <Meta label="Client" value={client?.company_name || "Not linked"} />
              <Meta label="Project manager" value="Not available" />
              <Meta label="Start date" value={formatDate(data.profile?.start_date)} />
              <Meta label="Target date" value={formatDate(data.profile?.target_date)} />
            </div>
          </div>
          <Link
            href={`/${workspaceSlug}/settings/projects/${projectId}/`}
            className="text-xs inline-flex items-center gap-2 rounded-xl bg-accent-primary px-4 py-2.5 font-medium text-white"
          >
            <Settings2 className="size-4" /> Project Settings
          </Link>
        </div>
      </header>

      <div className="grid min-h-0 xl:grid-cols-[13.5rem_minmax(0,1fr)]">
        <aside className="border-r border-subtle py-4 pr-4 max-xl:border-r-0 max-xl:border-b max-xl:pr-0">
          <Link
            href={`/${workspaceSlug}/summon/projects/`}
            className="text-xs mb-5 flex items-center gap-3 rounded-xl border border-subtle p-3 text-primary hover:bg-layer-1"
          >
            <ArrowLeft className="size-4" />
            <span>
              <strong className="block">All Projects</strong>
              <small className="text-[10px] text-secondary">View all projects</small>
            </span>
          </Link>
          <p className="tracking-widest mb-2 text-[9px] font-semibold text-tertiary uppercase">Project workspace</p>
          <nav className="flex flex-col gap-1 max-xl:flex-row max-xl:overflow-x-auto" aria-label="Project workspace">
            {projectLinks.map(([label, href, Icon], index) => (
              <Link
                key={label}
                href={href}
                aria-current={index === 0 ? "page" : undefined}
                className={`text-xs flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 ${index === 0 ? "bg-accent-subtle font-medium text-accent-primary" : "text-secondary hover:bg-layer-1"}`}
              >
                <Icon className="size-4" /> {label}
              </Link>
            ))}
          </nav>
          <p className="tracking-widest mt-6 mb-2 text-[9px] font-semibold text-tertiary uppercase">Quick actions</p>
          <div className="space-y-1">
            {["New Task", "Upload Document", "Schedule Meeting", "Create Milestone"].map((label) => (
              <Link
                key={label}
                href={
                  label === "New Task"
                    ? `/${workspaceSlug}/projects/${projectId}/issues/`
                    : label === "Schedule Meeting"
                      ? `/${workspaceSlug}/summon/meetings/`
                      : label === "Create Milestone"
                        ? `/${workspaceSlug}/projects/${projectId}/modules/`
                        : `/${workspaceSlug}/projects/${projectId}/pages/`
                }
                className="block rounded-lg px-3 py-2 text-[11px] text-secondary hover:bg-layer-1"
              >
                {label}
              </Link>
            ))}
          </div>
        </aside>

        <main className="min-w-0 py-4 xl:pl-5">
          <nav className="flex gap-6 overflow-x-auto border-b border-subtle" aria-label="Project section tabs">
            {["Overview", "Tasks", "Milestones", "Documents", "Repositories", "Deployments", "Activity", "Files"].map(
              (label, index) => (
                <Link
                  key={label}
                  href={
                    index === 0
                      ? `/${workspaceSlug}/summon/projects/${projectId}/`
                      : projectLinks.find(([item]) => item === label)?.[1] || `/${workspaceSlug}/summon/resources/`
                  }
                  className={`shrink-0 border-b-2 px-1 pb-3 text-[11px] ${index === 0 ? "border-accent-primary font-medium text-accent-primary" : "border-transparent text-secondary"}`}
                >
                  {label}
                </Link>
              )
            )}
          </nav>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <MetricCard
              label="Overall Progress"
              value={`${data.progress.percentage}%`}
              detail={`${data.progress.completed} of ${data.progress.total} completed`}
              icon={Gauge}
            />
            <MetricCard
              label="Current Phase"
              value={data.profile?.phase || "Not set"}
              detail="Project profile"
              icon={ShieldCheck}
            />
            <MetricCard
              label="Next Milestone"
              value={data.milestones[0]?.name || "Not set"}
              detail={formatDate(data.milestones[0]?.target_date)}
              icon={CalendarDays}
            />
            <MetricCard
              label="Open Tasks"
              value={String(openIssues.length)}
              detail={data.progress.overdue ? `${data.progress.overdue} overdue` : "No overdue tasks"}
              icon={ListChecks}
            />
            <MetricCard label="Open Issues" value={String(openIssues.length)} detail="Plane work items" icon={Circle} />
          </div>

          <div className="mt-4 grid gap-4 2xl:grid-cols-[1.05fr_0.9fr_1fr]">
            <Panel title="Project Timeline">
              <div className="space-y-0">
                {data.milestones.slice(0, 7).map((milestone, index) => (
                  <Link key={milestone.id} href={milestone.href} className="relative flex gap-3 pb-4 last:pb-0">
                    {index < data.milestones.length - 1 && (
                      <span className="bg-subtle absolute top-3 bottom-0 left-[5px] w-px" />
                    )}
                    <span className="border-accent-primary relative mt-1 size-3 shrink-0 rounded-full border-2 bg-surface-1" />
                    <span className="min-w-0 flex-1">
                      <span className="text-[10px] text-secondary">{formatDate(milestone.target_date)}</span>
                      <strong className="text-xs mt-0.5 block truncate font-medium text-primary">
                        {milestone.name}
                      </strong>
                    </span>
                    <span className="rounded-full bg-layer-1 px-2 py-1 text-[10px] text-secondary">
                      {milestone.completion}%
                    </span>
                  </Link>
                ))}
                {!data.milestones.length && <Empty text="No milestones yet." />}
              </div>
            </Panel>

            <Panel title="Tasks Overview" href={`/${workspaceSlug}/projects/${projectId}/issues/`}>
              <div
                className="mx-auto grid size-32 place-items-center rounded-full"
                style={{
                  background: `conic-gradient(var(--background-color-accent-primary) ${data.progress.percentage}%, var(--background-color-layer-2) 0)`,
                }}
              >
                <div className="grid size-24 place-items-center rounded-full bg-surface-1 text-center">
                  <span>
                    <strong className="text-2xl block text-primary">{data.progress.total}</strong>
                    <small className="text-[10px] text-secondary">Total Tasks</small>
                  </span>
                </div>
              </div>
              <div className="mt-5 grid grid-cols-2 gap-2 text-[10px]">
                <Legend label="Completed" value={completedIssues.length} />
                <Legend label="Open" value={openIssues.length} />
                <Legend label="Overdue" value={data.progress.overdue} />
                <Legend label="Unclassified" value={Math.max(0, data.progress.total - data.issues.length)} />
              </div>
            </Panel>

            <Panel title="Latest Activity">
              <div className="divide-y divide-subtle">
                {data.activity.slice(0, 6).map((item) => (
                  <Link key={item.id} href={item.href} className="flex gap-3 py-2.5 first:pt-0">
                    <Activity className="size-4 shrink-0 text-accent-primary" />
                    <span className="min-w-0">
                      <strong className="text-xs block truncate font-medium text-primary">{item.label}</strong>
                      <small className="text-[10px] text-secondary">{formatDate(item.created_at)}</small>
                    </span>
                  </Link>
                ))}
                {!data.activity.length && <Empty text="No recent activity." />}
              </div>
            </Panel>
          </div>

          <div className="mt-4 grid gap-4 2xl:grid-cols-[1.05fr_0.9fr_1fr]">
            <Panel title="Quick Access">
              <div className="grid grid-cols-2 gap-2">
                {data.resources.slice(0, 8).map((resource) => (
                  <a
                    key={resource.id}
                    href={resource.url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex min-w-0 items-center gap-2 rounded-xl border border-subtle p-2.5 hover:bg-layer-1"
                  >
                    <FolderGit2 className="size-4 shrink-0 text-accent-primary" />
                    <span className="truncate text-[10px] text-primary">{resource.title}</span>
                    <ExternalLink className="ml-auto size-3 text-tertiary" />
                  </a>
                ))}
                {!data.resources.length && <Empty text="No resources linked." />}
              </div>
            </Panel>
            <Panel title="Team Members" href={`/${workspaceSlug}/settings/projects/${projectId}/members/`}>
              <div className="space-y-2">
                {members.slice(0, 6).map(
                  (member) =>
                    member && (
                      <div key={member.id} className="flex items-center gap-2">
                        <span className="grid size-7 place-items-center rounded-full bg-layer-2 text-[10px] font-medium text-primary">
                          {member.display_name?.slice(0, 1) || "?"}
                        </span>
                        <span className="text-xs truncate text-primary">{member.display_name || member.email}</span>
                      </div>
                    )
                )}
                {!members.length && <Empty text="No accessible member profiles." />}
              </div>
            </Panel>
            <Panel title="Project Health">
              <div className="mb-4 flex items-center gap-3 rounded-xl bg-success-subtle p-3">
                <ShieldCheck className="size-7 text-success-primary" />
                <div>
                  <p className="text-[10px] text-secondary">Overall health</p>
                  <p className="text-sm font-semibold text-success-primary">{data.profile?.health || "Not set"}</p>
                </div>
              </div>
              <div className="space-y-2">
                <HealthRow label="Schedule" value={data.progress.overdue ? "Needs attention" : "On track"} />
                <HealthRow label="Scope" value="Not available" />
                <HealthRow label="Budget" value={data.profile?.budget || "Not set"} />
                <HealthRow label="Quality" value="Not available" />
              </div>
            </Panel>
          </div>
        </main>
      </div>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-tertiary">{label}</span>
      <strong className="ml-2 font-medium text-primary">{value}</strong>
    </div>
  );
}
function MetricCard({
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
          <Link href={href} className="inline-flex items-center gap-1 text-[10px] text-secondary">
            See all <ChevronRight className="size-3" />
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}
function Legend({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between rounded-lg bg-layer-1 px-2.5 py-2">
      <span className="text-secondary">{label}</span>
      <strong className="text-primary">{value}</strong>
    </div>
  );
}
function HealthRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-subtle pb-2 last:border-0">
      <span className="text-[10px] text-secondary">{label}</span>
      <span className="text-[10px] font-medium text-primary">{value}</span>
    </div>
  );
}
function Empty({ text }: { text: string }) {
  return <p className="text-xs rounded-xl border border-dashed border-subtle p-4 text-center text-tertiary">{text}</p>;
}
