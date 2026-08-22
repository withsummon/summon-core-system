/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { CalendarDays, ExternalLink, FileText, FolderGit2, Settings2 } from "lucide-react";
import Link from "next/link";
import useSWR from "swr";
import { SummonProgressBar, SummonProgressRing } from "@/components/summon/progress";
import { SummonRequestState } from "@/components/summon/request-state";
import { SummonCard, SummonScreen } from "@/components/summon/screen";
import { summonService } from "@/services/summon.service";
import type { Route } from "./+types/page";

function hasStatus(error: unknown, status: number) {
  if (typeof error !== "object" || error === null || !("response" in error)) return false;
  const { response } = error;
  return typeof response === "object" && response !== null && "status" in response && response.status === status;
}

export default function SummonProjectOverviewPage({ params }: Route.ComponentProps) {
  const { workspaceSlug, projectId } = params;
  const { data, error, isLoading, mutate } = useSWR(["summon-project-overview", workspaceSlug, projectId], () =>
    summonService.getProjectOverview(workspaceSlug, projectId)
  );

  if (!data) {
    if (hasStatus(error, 403)) return <SummonRequestState permissionError />;
    if (hasStatus(error, 404))
      return <SummonRequestState validationError="This project is unavailable or you no longer have access." />;
    return <SummonRequestState loading={isLoading} error={error} onRetry={() => void mutate()} />;
  }

  const tabs = [
    ["Overview", `/${workspaceSlug}/summon/projects/${projectId}/`],
    ["Tasks", `/${workspaceSlug}/projects/${projectId}/issues/`],
    ["Milestones", `/${workspaceSlug}/projects/${projectId}/modules/`],
    ["Documents", `/${workspaceSlug}/projects/${projectId}/pages/`],
  ] as const;
  return (
    <SummonScreen
      title={data.project.name}
      description={data.project.description || `${data.project.identifier} delivery workspace.`}
      actions={
        <Link
          href={`/${workspaceSlug}/settings/projects/${projectId}/`}
          className="text-xs inline-flex items-center gap-2 rounded-xl border border-subtle px-3 py-2 font-medium text-primary focus-visible:outline focus-visible:outline-2"
        >
          <Settings2 className="size-3.5" /> Project settings
        </Link>
      }
    >
      <nav aria-label="Project navigation" className="flex gap-2 overflow-x-auto pb-1">
        {tabs.map(([label, href]) => (
          <Link
            key={label}
            href={href}
            aria-current={label === "Overview" ? "page" : undefined}
            className={`text-xs shrink-0 rounded-xl px-3 py-2 font-medium focus-visible:outline focus-visible:outline-2 ${label === "Overview" ? "bg-accent-primary text-on-color" : "border border-subtle bg-surface-1 text-secondary"}`}
          >
            {label}
          </Link>
        ))}
      </nav>
      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(18rem,0.8fr)]">
        <div className="space-y-4">
          <SummonCard>
            <div className="flex flex-wrap items-center gap-5">
              <SummonProgressRing value={data.progress.percentage} label="Project completion" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-primary">Delivery progress</p>
                <p className="text-xs mt-1 text-secondary">
                  {data.progress.completed} of {data.progress.total} issues completed · {data.progress.overdue} overdue
                </p>
                <div className="mt-3">
                  <SummonProgressBar value={data.progress.percentage} label="Project completion" />
                </div>
              </div>
            </div>
            <div className="mt-5 grid gap-3 border-t border-subtle pt-4 sm:grid-cols-2">
              <div>
                <p className="text-[10px] font-medium tracking-wide text-tertiary uppercase">Delivery status</p>
                <p className="text-xs mt-1 font-medium text-primary">{data.profile?.delivery_status || "Not set"}</p>
              </div>
              <div>
                <p className="text-[10px] font-medium tracking-wide text-tertiary uppercase">Commercial budget</p>
                <p className="text-xs mt-1 font-medium text-primary">{data.profile?.budget || "Not set"}</p>
              </div>
            </div>
          </SummonCard>
          <OverviewList
            title="Milestones"
            empty="No milestones yet."
            items={data.milestones.map((milestone) => ({
              id: milestone.id,
              href: milestone.href,
              title: milestone.name,
              detail: milestone.target_date || "No target date",
              badge: `${milestone.completion}%`,
            }))}
          />
          <OverviewList
            title="Recent issues"
            empty="No issues yet."
            items={data.issues.map((issue) => ({
              id: issue.id,
              href: `/${workspaceSlug}/projects/${projectId}/issues/${issue.id}/`,
              title: issue.name,
              detail: issue.state?.name || "No status",
            }))}
          />
        </div>
        <div className="space-y-4">
          <OverviewList
            title="Pages"
            empty="No accessible Pages yet."
            icon={FileText}
            items={data.pages.map((page) => ({ id: page.id, href: page.href, title: page.name }))}
          />
          <ResourceList resources={data.resources} />
          <OverviewList
            title="Meetings"
            empty="No project meetings."
            icon={CalendarDays}
            items={data.meetings.map((meeting) => ({
              id: meeting.id,
              href: `/${workspaceSlug}/summon/meetings/`,
              title: meeting.title,
              detail: meeting.starts_at.slice(0, 10),
            }))}
          />
          <OverviewList
            title="Activity"
            empty="No recent activity."
            items={data.activity.slice(0, 5).map((activity) => ({
              id: activity.id,
              href: activity.href,
              title: activity.label,
              detail: activity.created_at.slice(0, 10),
            }))}
          />
        </div>
      </div>
    </SummonScreen>
  );
}

function OverviewList(props: {
  title: string;
  empty: string;
  icon?: typeof FileText;
  items: Array<{ id: string; href: string; title: string; detail?: string; badge?: string }>;
}) {
  const Icon = props.icon;
  return (
    <SummonCard>
      <h2 className="text-xs font-semibold text-primary">{props.title}</h2>
      <div className="mt-3 divide-y divide-subtle">
        {props.items.map((item) => (
          <Link
            key={item.id}
            href={item.href}
            className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0 focus-visible:outline focus-visible:outline-2"
          >
            {Icon ? <Icon className="size-4 shrink-0 text-accent-primary" /> : null}
            <span className="min-w-0 flex-1">
              <span className="text-xs block truncate font-medium text-primary">{item.title}</span>
              {item.detail ? <span className="text-[10px] text-secondary">{item.detail}</span> : null}
            </span>
            {item.badge ? (
              <span className="rounded-full bg-layer-2 px-2 py-1 text-[10px] text-secondary">{item.badge}</span>
            ) : (
              <ExternalLink className="size-3.5 shrink-0 text-tertiary" />
            )}
          </Link>
        ))}
        {!props.items.length ? <p className="text-xs py-3 text-tertiary">{props.empty}</p> : null}
      </div>
    </SummonCard>
  );
}

function ResourceList({ resources }: { resources: Array<{ id: string; title: string; url: string }> }) {
  return (
    <SummonCard>
      <h2 className="text-xs font-semibold text-primary">Resources</h2>
      <div className="mt-3 space-y-2">
        {resources.map((resource) => (
          <a
            key={resource.id}
            href={resource.url}
            target="_blank"
            rel="noreferrer"
            className="flex min-w-0 items-center gap-2 rounded-xl border border-subtle bg-layer-1 p-2.5 focus-visible:outline focus-visible:outline-2"
          >
            <FolderGit2 className="size-4 shrink-0 text-accent-primary" />
            <span className="min-w-0 flex-1 truncate text-[11px] font-medium text-primary">{resource.title}</span>
            <ExternalLink className="size-3.5 shrink-0 text-tertiary" />
          </a>
        ))}
        {!resources.length ? <p className="text-xs py-3 text-tertiary">No linked resources.</p> : null}
      </div>
    </SummonCard>
  );
}
