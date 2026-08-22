/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import Link from "next/link";
import { Download } from "lucide-react";
import type { ISummonClient, ISummonReportFilters, ISummonReportSummary } from "@plane/types";
import { SummonProgressBar, SummonProgressRing } from "@/components/summon/progress";
import { SummonRequestState } from "@/components/summon/request-state";
import { SummonCard, SummonMetric, SummonScreen } from "@/components/summon/screen";
import { ReportFilters, StatusBars, TrendChart } from "./report-visuals";
import { percentage, reportLabel, type TReportFilterParam } from "./report-view-model";

type TReportViewProps = {
  data?: ISummonReportSummary;
  error?: unknown;
  isLoading: boolean;
  filters: ISummonReportFilters;
  projects: Array<{ id: string; name: string }>;
  clients: ISummonClient[];
  exportUrl: string;
  onFilterChange: (name: TReportFilterParam, value: string) => void;
  onRetry: () => void;
};

export function ReportView(props: TReportViewProps) {
  const { data, error, isLoading, filters, projects, clients, exportUrl, onFilterChange, onRetry } = props;
  const completion = data ? percentage(data.issues.completed, data.issues.total) : 0;
  const isEmpty = data
    ? data.projects +
        data.issues.total +
        data.commercial.clients +
        data.commercial.opportunities +
        data.knowledge.pages +
        data.knowledge.files +
        data.meetings +
        data.automation.jobs ===
      0
    : false;
  return (
    <SummonScreen
      title="Management & Reporting"
      description="Live portfolio, commercial, delivery, knowledge, meeting, and automation reporting from authorized records."
      actions={
        <>
          {data ? (
            <a
              href={exportUrl}
              className="text-xs focus-visible:outline-accent-primary inline-flex h-8 items-center gap-2 rounded-md bg-accent-primary px-3 font-medium text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
            >
              <Download className="size-3.5" aria-hidden="true" />
              Download CSV
            </a>
          ) : null}
          <button
            type="button"
            disabled
            title="PDF export is not supported"
            className="text-xs h-8 cursor-not-allowed rounded-md border border-subtle px-3 text-tertiary opacity-70"
          >
            PDF unavailable
          </button>
        </>
      }
    >
      <ReportFilters filters={filters} projects={projects} clients={clients} onFilterChange={onFilterChange} />
      {!data ? (
        <SummonRequestState loading={isLoading} error={error} onRetry={onRetry} />
      ) : isEmpty ? (
        <SummonRequestState
          empty
          emptyMessage="No authorized records match these report filters. Change or clear a filter to widen the view."
        />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <SummonMetric label="Projects" value={data.projects} detail="Accessible portfolio" />
            <SummonMetric label="Work items" value={data.issues.total} detail={`${completion}% complete`} />
            <SummonMetric label="Overdue" value={data.issues.overdue} detail="Open past due date" />
            <SummonMetric
              label="Opportunities"
              value={data.commercial.opportunities}
              detail={`${data.commercial.clients} clients`}
            />
            <SummonMetric label="Open pipeline" value={data.commercial.pipeline_value} detail="Server decimal value" />
          </div>

          <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(18rem,0.65fr)]">
            <SummonCard>
              <h2 className="text-sm font-semibold text-primary">Project health</h2>
              <div className="mt-3 divide-y divide-subtle">
                {data.project_health.map((project) => (
                  <div
                    key={project.project_id}
                    className="grid gap-2 py-3 first:pt-0 last:pb-0 sm:grid-cols-[1fr_auto]"
                  >
                    <div className="min-w-0">
                      <p className="text-xs truncate font-medium text-primary">{project.name}</p>
                      <p className="mt-1 text-[10px] font-medium text-secondary">{reportLabel(project.health)}</p>
                    </div>
                    <div className="min-w-36 sm:w-48">
                      <div className="mb-1 flex justify-end text-[10px] font-semibold text-primary">
                        {project.completion}%
                      </div>
                      <SummonProgressBar value={project.completion} label={`${project.name} completion`} />
                    </div>
                  </div>
                ))}
              </div>
            </SummonCard>
            <SummonCard>
              <h2 className="text-sm font-semibold text-primary">Delivery progress</h2>
              <div className="mt-4 flex items-center gap-4">
                <SummonProgressRing value={completion} label="Portfolio completion" />
                <dl className="text-xs grid flex-1 grid-cols-2 gap-3">
                  <div>
                    <dt className="text-secondary">Completed</dt>
                    <dd className="mt-1 font-semibold text-primary">{data.issues.completed}</dd>
                  </div>
                  <div>
                    <dt className="text-secondary">Remaining</dt>
                    <dd className="mt-1 font-semibold text-primary">{data.issues.total - data.issues.completed}</dd>
                  </div>
                </dl>
              </div>
              <StatusBars label="Due date" items={data.due_date_buckets} />
            </SummonCard>
          </div>

          <div className="grid items-start gap-4 lg:grid-cols-2">
            <SummonCard>
              <h2 className="text-sm font-semibold text-primary">Opportunity pipeline</h2>
              <div className="mt-3 space-y-3">
                {data.opportunity_stages.map((stage) => (
                  <div key={stage.stage}>
                    <div className="mb-1.5 flex items-center justify-between gap-3 text-[11px]">
                      <span className="font-medium text-secondary">{reportLabel(stage.stage)}</span>
                      <span className="text-right font-semibold text-primary">
                        {stage.count} · {stage.value}
                      </span>
                    </div>
                    <SummonProgressBar
                      value={percentage(stage.count, data.commercial.opportunities)}
                      label={`${reportLabel(stage.stage)} opportunities`}
                    />
                  </div>
                ))}
              </div>
            </SummonCard>
            <SummonCard>
              <h2 className="text-sm font-semibold text-primary">Completion trend</h2>
              <TrendChart
                label="Completed work items"
                points={data.completion_trend.map((point) => ({ date: point.date, value: point.completed }))}
              />
            </SummonCard>
          </div>

          <div className="grid items-start gap-4 lg:grid-cols-3">
            <SummonCard>
              <h2 className="text-sm font-semibold text-primary">Knowledge</h2>
              <dl className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-layer-1 p-3">
                  <dt className="text-[11px] text-secondary">Pages</dt>
                  <dd className="text-xl mt-1 font-semibold text-primary">{data.knowledge.pages}</dd>
                </div>
                <div className="rounded-xl bg-layer-1 p-3">
                  <dt className="text-[11px] text-secondary">Files</dt>
                  <dd className="text-xl mt-1 font-semibold text-primary">{data.knowledge.files}</dd>
                </div>
              </dl>
            </SummonCard>
            <SummonCard>
              <h2 className="text-sm font-semibold text-primary">Meetings · {data.meetings}</h2>
              <StatusBars
                label="Meeting status"
                items={data.meeting_statuses.map((item) => ({ label: item.status, count: item.count }))}
              />
              <TrendChart
                label="Meeting trend"
                points={data.meeting_trend.map((point) => ({ date: point.date, value: point.count }))}
              />
            </SummonCard>
            <SummonCard>
              <h2 className="text-sm font-semibold text-primary">Automation · {data.automation.jobs}</h2>
              <StatusBars
                label="Automation status"
                items={data.automation_statuses.map((item) => ({ label: item.status, count: item.count }))}
              />
              <TrendChart
                label="Automation usage"
                points={data.automation_usage.map((point) => ({ date: point.date, value: point.count }))}
              />
            </SummonCard>
          </div>

          <SummonCard>
            <h2 className="text-sm font-semibold text-primary">Recent activity</h2>
            <div className="mt-3 divide-y divide-subtle">
              {data.recent_activity.map((activity) => (
                <Link
                  key={activity.id}
                  href={activity.href}
                  className="flex items-center justify-between gap-4 py-2.5 first:pt-0 last:pb-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                >
                  <span className="text-xs min-w-0 truncate font-medium text-primary">{activity.label}</span>
                  <time className="shrink-0 text-[10px] text-secondary" dateTime={activity.created_at}>
                    {activity.created_at.slice(0, 10)}
                  </time>
                </Link>
              ))}
            </div>
          </SummonCard>
        </>
      )}
    </SummonScreen>
  );
}
