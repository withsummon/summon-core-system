/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { ReactNode } from "react";
import Link from "next/link";
import { FileSpreadsheet, Sparkles, WalletCards } from "lucide-react";
import type { ISummonClient, ISummonReportFilters, ISummonReportSummary } from "@plane/types";
import { capitalizeFirstLetter, replaceUnderscoreIfSnakeCase } from "@plane/utils";
import { SummonMetric, SummonMetricStrip, SummonPanel } from "@/components/summon/screen";
import { useWorkspaceMoney } from "@/components/summon/use-workspace-money";
import { PipelineChart, REPORT_CHART_COLORS, ReportDonut, ReportProgressRings } from "./report-charts";
import { percentage } from "./report-view-model";

const HEALTH_COLORS = {
  on_track: REPORT_CHART_COLORS.success,
  at_risk: REPORT_CHART_COLORS.warning,
  off_track: REPORT_CHART_COLORS.danger,
  not_assessed: REPORT_CHART_COLORS.neutral,
} as const;

type TReportPanelProps = { workspaceSlug: string; data: ISummonReportSummary };

export function ReportOverviewMetrics({ workspaceSlug, data }: TReportPanelProps) {
  const money = useWorkspaceMoney(workspaceSlug);
  const openOpportunities = data.opportunity_stages
    .filter(({ stage }) => stage !== "won" && stage !== "lost")
    .reduce((sum, item) => sum + item.count, 0);
  const averageHealth = data.project_health.length
    ? Math.round(data.project_health.reduce((sum, project) => sum + project.completion, 0) / data.project_health.length)
    : 0;
  return (
    <SummonMetricStrip>
      <SummonMetric label="Total revenue (YTD)" value="—" detail="No revenue data source" />
      <SummonMetric
        label="Active projects"
        value={data.projects}
        detail="Authorized portfolio"
        href={`/${workspaceSlug}/summon/projects/`}
      />
      <SummonMetric
        label="Open opportunities"
        value={openOpportunities}
        detail={money(data.commercial.pipeline_value)}
        href={`/${workspaceSlug}/summon/opportunities/`}
      />
      <SummonMetric
        label="Project health (avg)"
        value={
          <>
            {averageHealth}
            <span className="ml-1 text-13 font-medium text-tertiary">/100</span>
          </>
        }
        detail="Based on delivery completion"
      />
      <SummonMetric label="Overdue tasks" value={data.issues.overdue} detail="Open past due date" />
    </SummonMetricStrip>
  );
}

export function CompanyProgressPanel({ data }: { data: ISummonReportSummary }) {
  const completion = percentage(data.issues.completed, data.issues.total);
  const noDueDate = data.due_date_buckets.find(({ label }) => label === "No due date")?.count ?? 0;
  const progressRings = [
    {
      label: "Completed",
      value: data.issues.completed,
      maxValue: data.issues.total,
      color: REPORT_CHART_COLORS.accent,
    },
    { label: "Overdue", value: data.issues.overdue, maxValue: data.issues.total, color: REPORT_CHART_COLORS.danger },
    { label: "No due date", value: noDueDate, maxValue: data.issues.total, color: REPORT_CHART_COLORS.neutral },
  ];
  return (
    <SummonPanel title="Company Progress">
      <div className="flex-1">
        <ReportProgressRings
          items={progressRings}
          centerValue={`${completion}%`}
          centerLabel={`of ${data.issues.total} done`}
        />
      </div>
      <div className="mt-4 flex items-start gap-3 rounded-lg bg-accent-subtle px-3 py-2.5">
        <Sparkles className="mt-0.5 size-4 shrink-0 text-accent-primary" />
        <div>
          <p className="text-12 font-semibold text-accent-primary">Summon Insight</p>
          <p className="mt-0.5 text-12 text-secondary">
            {data.issues.total
              ? `${completion}% of authorized work items are complete.`
              : "No delivery data in this period."}
          </p>
        </div>
      </div>
    </SummonPanel>
  );
}

export function ProjectHealthPanel({ workspaceSlug, data }: TReportPanelProps) {
  const projectHealth = (Object.keys(HEALTH_COLORS) as Array<keyof typeof HEALTH_COLORS>).map((health) => ({
    label: capitalizeFirstLetter(replaceUnderscoreIfSnakeCase(health)),
    value: data.project_health.filter((project) => project.health === health).length,
    color: HEALTH_COLORS[health],
  }));
  const attentionProjects = data.project_health
    .filter((project) => project.health !== "on_track" && project.health !== "not_assessed")
    .slice(0, 3);
  return (
    <SummonPanel title="Project Health">
      <div>
        <ReportDonut items={projectHealth} centerLabel="Projects" />
      </div>
      <div className="mt-4 border-t border-subtle pt-3">
        <div className="flex items-center justify-between text-12">
          <span className="font-semibold text-primary">Top Attention Needed</span>
          <Link href={`/${workspaceSlug}/summon/projects/`} className="font-medium text-accent-primary">
            View all projects →
          </Link>
        </div>
        <div className="mt-2 divide-y divide-subtle">
          {attentionProjects.map((project) => (
            <Link
              key={project.project_id}
              href={`/${workspaceSlug}/summon/projects/${project.project_id}/`}
              className="flex items-center justify-between gap-3 py-2 text-12"
            >
              <span className="truncate font-medium text-primary" title={project.name}>
                {project.name}
              </span>
              <span className="rounded-md bg-warning-subtle px-2 py-1 font-semibold text-warning-primary">
                {project.completion}
              </span>
            </Link>
          ))}
          {!attentionProjects.length ? (
            <p className="py-3 text-12 text-tertiary">No projects currently need attention.</p>
          ) : null}
        </div>
      </div>
    </SummonPanel>
  );
}

export function PipelinePanel({ workspaceSlug, data }: TReportPanelProps) {
  const money = useWorkspaceMoney(workspaceSlug);
  const wonOpportunities = data.opportunity_stages.find(({ stage }) => stage === "won")?.count ?? 0;
  return (
    <SummonPanel title="Pipeline Overview">
      <div className="flex-1">
        <PipelineChart
          items={data.opportunity_stages.map((stage) => ({
            ...stage,
            label: capitalizeFirstLetter(replaceUnderscoreIfSnakeCase(stage.stage)),
            value: money(stage.value),
          }))}
          total={data.commercial.opportunities}
        />
      </div>
      <div className="mt-4 grid grid-cols-[minmax(0,1fr)_auto] divide-x divide-subtle rounded-lg bg-layer-1 p-3">
        <div className="min-w-0 pr-3">
          <p className="text-12 text-secondary">Total Pipeline Value</p>
          <p className="mt-1 text-lg font-semibold [overflow-wrap:anywhere] text-primary tabular-nums">
            {money(data.commercial.pipeline_value)}
          </p>
        </div>
        <div className="pl-3">
          <p className="text-12 text-secondary">Win Rate</p>
          <p className="mt-1 text-lg font-semibold text-primary tabular-nums">
            {percentage(wonOpportunities, data.commercial.opportunities)}%
          </p>
        </div>
      </div>
    </SummonPanel>
  );
}

export function InvestmentPanel() {
  return (
    <SummonPanel flush title="Investment Disbursement Progress">
      <div className="overflow-x-auto">
        <table className="table-stack w-full text-left text-12 md:min-w-[680px]">
          <thead className="border-y border-subtle bg-layer-1/40 text-secondary">
            <tr>
              {["Project", "Client", "Total Investment", "Disbursed", "Progress", "Next Disbursement"].map((label) => (
                <th key={label} className="px-4 py-3 font-medium">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colSpan={6} className="px-4 py-12 text-center text-secondary">
                <WalletCards className="mx-auto mb-2 size-5 text-tertiary" />
                No disbursement data source configured
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div className="border-t border-subtle px-4 py-3 text-12 text-tertiary">No investment records available</div>
    </SummonPanel>
  );
}

export function PortfolioPanel({
  workspaceSlug,
  clients,
  filters,
}: {
  workspaceSlug: string;
  clients: ISummonClient[];
  filters: ISummonReportFilters;
}) {
  const activeClients = clients.filter((client) => client.status === "active").length;
  const reportingYear = filters.dateTo?.slice(0, 4) ?? new Date().getUTCFullYear().toString();
  const newClients = clients.filter((client) => client.created_at.startsWith(reportingYear)).length;
  return (
    <SummonPanel
      title="Portfolio / Client Database"
      link={{ href: `/${workspaceSlug}/summon/clients/`, label: "View all clients" }}
    >
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-2 2xl:grid-cols-4">
        <MiniMetric label="Total Clients" value={clients.length} detail="Workspace records" />
        <MiniMetric
          label="Active Clients"
          value={activeClients}
          detail={`${percentage(activeClients, clients.length)}% of total`}
        />
        <MiniMetric label="New Clients (YTD)" value={newClients} detail={reportingYear} />
        <MiniMetric label="Client Retention" value="—" detail="No data source" />
      </div>
      <div className="mt-4">
        <p className="text-12 font-semibold text-primary">Top Clients by Revenue (YTD)</p>
        <div className="mt-2 rounded-lg border border-dashed border-subtle py-10 text-center text-12 text-tertiary">
          Revenue attribution is not configured for client records.
        </div>
      </div>
    </SummonPanel>
  );
}

export function RecentReportsPanel({ exportUrl }: { exportUrl: string }) {
  return (
    <SummonPanel title="Recent Reports">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <a
          href={exportUrl}
          className="flex min-w-0 items-center gap-3 rounded-lg border border-subtle p-3 hover:border-accent-strong"
        >
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-accent-subtle text-accent-primary">
            <FileSpreadsheet className="size-4" />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-12 font-semibold text-primary">Current Portfolio Report</span>
            <span className="mt-1 block text-12 text-secondary">CSV · Live data</span>
          </span>
        </a>
        {["Project Health Report", "Pipeline Report", "Investment Report", "Client Performance Report"].map((name) => (
          <div
            key={name}
            className="flex min-w-0 items-center gap-3 rounded-lg border border-dashed border-subtle p-3 opacity-70"
          >
            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-layer-1 text-tertiary">
              <FileSpreadsheet className="size-4" />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-12 font-semibold text-primary" title={name}>
                {name}
              </span>
              <span className="mt-1 block text-12 text-tertiary">Not generated</span>
            </span>
          </div>
        ))}
      </div>
    </SummonPanel>
  );
}

function MiniMetric(props: { label: string; value: ReactNode; detail: string }) {
  return (
    <div className="rounded-lg border border-subtle p-3">
      <p className="text-12 text-secondary">{props.label}</p>
      <p className="mt-1 text-lg font-semibold text-primary">{props.value}</p>
      <p className="mt-1 truncate text-12 text-tertiary">{props.detail}</p>
    </div>
  );
}
