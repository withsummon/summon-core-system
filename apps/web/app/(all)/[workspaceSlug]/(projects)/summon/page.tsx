/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { ArrowUpRight, CalendarDays, CheckCircle2, Circle, FileText, FolderGit2 } from "lucide-react";
import { observer } from "mobx-react";
import Link from "next/link";
import useSWR from "swr";
import { SummonRequestState } from "@/components/summon/request-state";
import { SummonCard, SummonMetric, SummonScreen } from "@/components/summon/screen";
import { useUser } from "@/hooks/store/user";
import { summonService } from "@/services/summon.service";
import type { Route } from "./+types/page";

const SectionTitle = ({ children, href }: { children: React.ReactNode; href?: string }) => (
  <div className="mb-2.5 flex items-center justify-between gap-3">
    <h2 className="text-xs font-semibold text-primary">{children}</h2>
    {href ? (
      <Link
        href={href}
        className="text-[10px] font-medium text-accent-primary focus-visible:outline focus-visible:outline-2"
      >
        See all →
      </Link>
    ) : null}
  </div>
);

function SummonOverviewPage({ params }: Route.ComponentProps) {
  const { workspaceSlug } = params;
  const { data: user } = useUser();
  const { data, error, isLoading, mutate } = useSWR(["summon-home", workspaceSlug], () =>
    summonService.getHomeSummary(workspaceSlug)
  );

  if (!data) return <SummonRequestState loading={isLoading} error={error} onRetry={() => void mutate()} />;

  const firstName = (user?.display_name || user?.first_name || "there").split(" ")[0];
  const priorityCount = data.priority.length;

  return (
    <SummonScreen title={`Welcome back, ${firstName}!`} description="Your delivery pulse across the workspace.">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <SummonMetric label="Active projects" value={data.counts.projects} detail="Accessible Plane projects" />
        <SummonMetric label="Work items" value={data.counts.issues} detail={`${data.priority.length} priority`} />
        <SummonMetric label="Clients" value={data.counts.clients} detail="Commercial accounts" />
        <SummonMetric label="Opportunities" value={data.counts.opportunities} detail="Current pipeline" />
      </div>
      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(18rem,0.8fr)]">
        <div className="space-y-4">
          <SummonCard>
            <SectionTitle href={`/${workspaceSlug}/workspace-views/all-issues/`}>Priority work</SectionTitle>
            <div className="divide-y divide-subtle">
              {data.priority.map((issue) => (
                <Link
                  key={issue.id}
                  href={`/${workspaceSlug}/projects/${issue.project.id}/issues/${issue.id}/`}
                  className="flex items-center gap-2.5 py-2.5 first:pt-0 last:pb-0 focus-visible:outline focus-visible:outline-2"
                >
                  {issue.completed ? (
                    <CheckCircle2 className="size-4 shrink-0 text-success-primary" />
                  ) : (
                    <Circle className="size-4 shrink-0 text-danger-primary" />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="text-xs block truncate font-medium text-primary">{issue.name}</span>
                    <span className="block truncate text-[10px] text-secondary">
                      {issue.project.identifier} · {issue.project.name}
                    </span>
                  </span>
                  <ArrowUpRight className="size-3.5 shrink-0 text-tertiary" />
                </Link>
              ))}
              {!data.priority.length ? (
                <p className="text-xs py-4 text-center text-tertiary">No priority work right now.</p>
              ) : null}
            </div>
          </SummonCard>
          <SummonCard>
            <SectionTitle href={`/${workspaceSlug}/summon/projects/`}>Active project health</SectionTitle>
            <div className="grid gap-3 sm:grid-cols-2">
              {data.projects.map((project) => (
                <Link
                  key={project.id}
                  href={`/${workspaceSlug}/summon/projects/${project.id}/`}
                  className="rounded-xl border border-subtle bg-layer-1 p-3 focus-visible:outline focus-visible:outline-2"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs truncate font-semibold text-primary">{project.name}</p>
                      <p className="mt-1 text-[10px] text-secondary">{project.identifier}</p>
                    </div>
                    <span className="rounded-full bg-accent-subtle px-2 py-1 text-[9px] font-medium text-accent-primary">
                      {project.health.replaceAll("_", " ")}
                    </span>
                  </div>
                  <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-layer-2">
                    <div
                      className="h-full rounded-full bg-accent-primary"
                      style={{ width: `${project.completion}%` }}
                    />
                  </div>
                  <p className="mt-2 text-[10px] text-secondary">{project.completion}% complete</p>
                </Link>
              ))}
              {!data.projects.length ? <p className="text-xs text-tertiary">No accessible projects yet.</p> : null}
            </div>
          </SummonCard>
          <SummonCard>
            <SectionTitle>Recent activity</SectionTitle>
            <div className="divide-y divide-subtle">
              {data.recent_activity.slice(0, 6).map((activity) => (
                <Link
                  key={activity.id}
                  href={activity.href}
                  className="block py-2.5 first:pt-0 last:pb-0 focus-visible:outline focus-visible:outline-2"
                >
                  <p className="text-xs truncate font-medium text-primary">{activity.label}</p>
                  <time className="text-[10px] text-secondary" dateTime={activity.created_at}>
                    {activity.created_at.slice(0, 10)}
                  </time>
                </Link>
              ))}
              {!data.recent_activity.length ? (
                <p className="text-xs py-4 text-center text-tertiary">No recent activity.</p>
              ) : null}
            </div>
          </SummonCard>
        </div>
        <div className="space-y-4">
          <SummonCard>
            <SectionTitle href={`/${workspaceSlug}/summon/resources/`}>Quick access</SectionTitle>
            <div className="space-y-2">
              {data.resources.slice(0, 5).map((resource) => (
                <a
                  key={resource.id}
                  href={resource.url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex min-w-0 items-center gap-2 rounded-xl border border-subtle bg-layer-1 p-2.5 focus-visible:outline focus-visible:outline-2"
                >
                  <FolderGit2 className="size-4 shrink-0 text-accent-primary" />
                  <span className="min-w-0 flex-1 truncate text-[11px] font-medium text-primary">{resource.title}</span>
                  <ArrowUpRight className="size-3.5 shrink-0 text-tertiary" />
                </a>
              ))}
              {!data.resources.length ? (
                <Link
                  href={`/${workspaceSlug}/summon/resources/`}
                  className="text-xs block rounded-xl border border-dashed border-subtle p-3 text-center text-tertiary focus-visible:outline focus-visible:outline-2"
                >
                  Add your first resource
                </Link>
              ) : null}
            </div>
          </SummonCard>
          <SummonCard>
            <SectionTitle href={`/${workspaceSlug}/summon/meetings/`}>Upcoming meetings</SectionTitle>
            <div className="space-y-2.5">
              {data.upcoming_meetings.slice(0, 5).map((meeting) => (
                <Link
                  key={meeting.id}
                  href={`/${workspaceSlug}/summon/meetings/`}
                  className="flex gap-2.5 rounded-xl border border-subtle bg-layer-1 p-2.5 focus-visible:outline focus-visible:outline-2"
                >
                  <CalendarDays className="size-4 shrink-0 text-accent-primary" />
                  <span className="min-w-0">
                    <span className="block truncate text-[11px] font-medium text-primary">{meeting.title}</span>
                    <time className="block text-[10px] text-secondary" dateTime={meeting.starts_at}>
                      {meeting.starts_at.slice(0, 10)}
                    </time>
                  </span>
                </Link>
              ))}
              {!data.upcoming_meetings.length ? (
                <p className="text-xs py-3 text-center text-tertiary">No upcoming meetings.</p>
              ) : null}
            </div>
          </SummonCard>
          <SummonCard>
            <div className="flex items-center gap-2.5">
              <FileText className="size-4 text-accent-primary" />
              <div>
                <p className="text-xs font-semibold text-primary">Workspace focus</p>
                <p className="mt-0.5 text-[10px] text-secondary">{priorityCount} priority items need attention.</p>
              </div>
            </div>
          </SummonCard>
        </div>
      </div>
    </SummonScreen>
  );
}

export default observer(SummonOverviewPage);
