/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import useSWR from "swr";
import { Link } from "react-router";
import { Bell, BookOpen, BriefcaseBusiness, CheckCircle2, FolderKanban } from "lucide-react";
import { summonService } from "@/services/summon.service";
import { SummonCard, SummonMetric, SummonScreen } from "@/components/summon/screen";
import { SummonRequestState } from "@/components/summon/request-state";
import type { Route } from "./+types/page";

export default function SummonOverviewPage({ params }: Route.ComponentProps) {
  const { workspaceSlug } = params;
  const { data, error, isLoading, mutate } = useSWR(["summon-report", workspaceSlug], () =>
    summonService.getReport(workspaceSlug)
  );
  if (!data) return <SummonRequestState loading={isLoading} error={error} onRetry={() => void mutate()} />;

  const completion = data.issues.total ? Math.round((data.issues.completed / data.issues.total) * 100) : 0;

  return (
    <SummonScreen
      title="Here's what's happening today"
      description="One operational view over Plane projects, work items, pages, files, and Summon commercial records."
    >
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <SummonMetric label="Active projects" value={data.projects} detail="Plane projects" />
        <SummonMetric label="Work items" value={data.issues.total} detail={`${data.issues.completed} completed`} />
        <SummonMetric label="Clients" value={data.commercial.clients} detail="Commercial accounts" />
        <SummonMetric
          label="Opportunities"
          value={data.commercial.opportunities}
          detail={`${data.commercial.pipeline_value} pipeline`}
        />
        <SummonMetric label="Meetings" value={data.meetings} detail="Operational context" />
      </div>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(18rem,1fr)]">
        <SummonCard>
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-primary">Project health</h2>
              <p className="text-xs mt-1 text-secondary">Live completion across accessible Plane work items</p>
            </div>
            <span className="text-2xl font-semibold text-accent-primary">{completion}%</span>
          </div>
          <div className="mt-5 h-2 overflow-hidden rounded-full bg-layer-2">
            <div className="bg-accent-strong h-full rounded-full" style={{ width: `${completion}%` }} />
          </div>
          <div className="mt-5 grid grid-cols-3 gap-3">
            {[
              ["Completed", data.issues.completed],
              ["Open", Math.max(data.issues.total - data.issues.completed, 0)],
              ["Overdue", data.issues.overdue],
            ].map(([label, value]) => (
              <div key={label} className="rounded-lg bg-layer-1 p-3">
                <p className="text-xs text-secondary">{label}</p>
                <p className="text-lg mt-1 font-semibold text-primary">{value}</p>
              </div>
            ))}
          </div>
        </SummonCard>
        <SummonCard>
          <h2 className="text-sm font-semibold text-primary">Company snapshot</h2>
          <div className="mt-4 space-y-3">
            {[
              { Icon: BriefcaseBusiness, label: "Pipeline", value: data.commercial.pipeline_value },
              { Icon: BookOpen, label: "Knowledge pages", value: data.knowledge.pages },
              { Icon: FolderKanban, label: "Files", value: data.knowledge.files },
              { Icon: CheckCircle2, label: "Automation jobs", value: data.automation.jobs },
            ].map(({ Icon, label, value }) => (
              <div key={label} className="flex items-center justify-between gap-3">
                <div className="text-sm flex items-center gap-2 text-secondary">
                  <Icon className="size-4 text-accent-primary" />
                  {label}
                </div>
                <span className="text-sm font-semibold text-primary">{value}</span>
              </div>
            ))}
          </div>
        </SummonCard>
      </div>
      <SummonCard>
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-primary">Quick access</h2>
            <p className="text-xs mt-1 text-secondary">Native Plane records remain the source of truth.</p>
          </div>
          <Bell className="size-5 text-accent-primary" />
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["Projects", `/${workspaceSlug}/projects`],
            ["Tasks", `/${workspaceSlug}/workspace-views/all-issues`],
            ["Notifications", `/${workspaceSlug}/notifications`],
            ["Resources", `/${workspaceSlug}/summon/resources`],
          ].map(([label, href]) => (
            <Link
              key={label}
              className="text-sm rounded-lg border border-subtle bg-layer-1 px-3 py-3 font-medium text-primary hover:border-accent-strong"
              to={href}
            >
              {label}
            </Link>
          ))}
        </div>
      </SummonCard>
    </SummonScreen>
  );
}
