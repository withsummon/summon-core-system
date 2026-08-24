/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState, type ReactNode } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Clock3,
  FileSpreadsheet,
  FolderKanban,
  HeartPulse,
  Sparkles,
  Target,
  WalletCards,
} from "lucide-react";
import type { ISummonClient, ISummonReportFilters, ISummonReportSummary } from "@plane/types";
import { PageHead } from "@/components/core/page-title";
import { SummonRequestState } from "@/components/summon/request-state";
import { PipelineBars, ReportDonut, ReportFilters, ReportKpi, ReportLegend, ReportPanel } from "./report-visuals";
import { percentage, reportLabel, type TReportFilterParam } from "./report-view-model";

type TReportViewProps = {
  workspaceSlug: string;
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

const HEALTH_COLORS = {
  not_assessed: "#94a3b8",
  on_track: "#48b979",
  at_risk: "#f4bd42",
  off_track: "#ef5b5b",
};

const REPORT_TABS = [
  { id: "overview", label: "Overview" },
  { id: "company_progress", label: "Company Progress" },
  { id: "project_health", label: "Project Health" },
  { id: "pipeline", label: "Pipeline" },
  { id: "investment", label: "Investment Disbursement" },
  { id: "portfolio", label: "Portfolio / Client Database" },
] as const;

type TReportTab = (typeof REPORT_TABS)[number]["id"];

export function ReportView(props: TReportViewProps) {
  const { workspaceSlug, data, error, isLoading, filters, projects, clients, exportUrl, onFilterChange, onRetry } =
    props;
  const [activeTab, setActiveTab] = useState<TReportTab>("overview");
  const completion = data ? percentage(data.issues.completed, data.issues.total) : 0;

  if (!data) {
    return (
      <div className="min-h-full p-4 lg:p-5">
        <PageHead title="Management & Reporting · Summon Core" />
        <SummonRequestState loading={isLoading} error={error} onRetry={onRetry} />
      </div>
    );
  }

  const openOpportunities = data.opportunity_stages
    .filter(({ stage }) => stage !== "won" && stage !== "lost")
    .reduce((sum, item) => sum + item.count, 0);
  const wonOpportunities = data.opportunity_stages.find(({ stage }) => stage === "won")?.count ?? 0;
  const averageHealth = data.project_health.length
    ? Math.round(data.project_health.reduce((sum, project) => sum + project.completion, 0) / data.project_health.length)
    : 0;
  const projectHealth = ["not_assessed", "on_track", "at_risk", "off_track"].map((health) => ({
    label: reportLabel(health),
    count: data.project_health.filter((project) => project.health === health).length,
    color: HEALTH_COLORS[health as keyof typeof HEALTH_COLORS],
  }));
  const attentionProjects = data.project_health
    .filter((project) => project.health !== "on_track" && project.health !== "not_assessed")
    .slice(0, 3);
  const activeClients = clients.filter((client) => client.status === "active").length;
  const reportingYear = filters.dateTo?.slice(0, 4) ?? new Date().getUTCFullYear().toString();
  const newClients = clients.filter((client) => client.created_at.startsWith(reportingYear)).length;
  const showTab = (tab: TReportTab) => activeTab === "overview" || activeTab === tab;

  return (
    <section className="mx-auto min-h-full w-full max-w-[1600px] overflow-hidden p-4 lg:p-5">
      <PageHead title="Management & Reporting · Summon Core" />
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-primary">Management & Reporting</h1>
          <p className="text-xs mt-1 text-secondary">Real-time insights and performance overview</p>
        </div>
        <ReportFilters
          filters={filters}
          projects={projects}
          clients={clients}
          exportUrl={exportUrl}
          canExport
          onFilterChange={onFilterChange}
        />
      </header>

      <nav className="mt-4 flex gap-6 overflow-x-auto border-b border-subtle text-[11px] font-medium text-secondary">
        {REPORT_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`shrink-0 border-b-2 px-0.5 pb-3 ${activeTab === tab.id ? "border-accent-primary text-accent-primary" : "border-transparent"}`}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {activeTab === "overview" ? (
        <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-5">
          <ReportKpi
            icon={<WalletCards className="size-4.5" />}
            label="Total Revenue (YTD)"
            value="—"
            detail={<span>No revenue data source</span>}
          />
          <ReportKpi
            icon={<FolderKanban className="size-4.5" />}
            label="Active Projects"
            value={data.projects}
            detail={<span className="text-success-primary">Authorized portfolio</span>}
          />
          <ReportKpi
            icon={<Target className="size-4.5" />}
            label="Open Opportunities"
            value={openOpportunities}
            detail={<span>{data.commercial.pipeline_value} potential value</span>}
          />
          <ReportKpi
            icon={<HeartPulse className="size-4.5" />}
            label="Project Health (Avg)"
            value={
              <>
                {averageHealth}
                <span className="text-xs ml-1 text-secondary">/100</span>
              </>
            }
            detail={<span className="text-success-primary">Based on delivery completion</span>}
          />
          <ReportKpi
            icon={<Clock3 className="size-4.5" />}
            label="Overdue Tasks"
            value={data.issues.overdue}
            detail={<span className="text-danger-primary">Open past due date</span>}
          />
        </div>
      ) : null}

      {showTab("company_progress") || showTab("project_health") || showTab("pipeline") ? (
        <div
          className={`mt-4 grid items-stretch gap-3 ${activeTab === "overview" ? "xl:grid-cols-[1fr_1fr_1.08fr]" : "grid-cols-1"}`}
        >
          {showTab("company_progress") ? (
            <ReportPanel className="flex flex-col p-4">
              <PanelHeader title="Company Progress" />
              <div className="mt-4 grid flex-1 items-center gap-4 sm:grid-cols-[1fr_1fr]">
                <ReportDonut
                  items={[
                    { label: "Completed", count: data.issues.completed, color: "#376df6" },
                    {
                      label: "Remaining",
                      count: Math.max(0, data.issues.total - data.issues.completed),
                      color: "#b8c9f5",
                    },
                  ]}
                  center={`${completion}%`}
                  caption="Overall Progress"
                />
                <ReportLegend
                  items={[
                    { label: "Completed", count: data.issues.completed, color: "#376df6" },
                    {
                      label: "Remaining",
                      count: Math.max(0, data.issues.total - data.issues.completed),
                      color: "#48b979",
                    },
                    { label: "Overdue", count: data.issues.overdue, color: "#f4bd42" },
                    {
                      label: "No due date",
                      count: data.due_date_buckets.find(({ label }) => label === "No due date")?.count ?? 0,
                      color: "#b8bfd1",
                    },
                  ]}
                />
              </div>
              <div className="mt-4 flex items-start gap-3 rounded-lg bg-accent-subtle px-3 py-2.5">
                <Sparkles className="mt-0.5 size-4 shrink-0 text-accent-primary" />
                <div>
                  <p className="text-[10px] font-semibold text-accent-primary">Summon Insight</p>
                  <p className="mt-0.5 text-[10px] text-secondary">
                    {data.issues.total
                      ? `${completion}% of authorized work items are complete.`
                      : "No delivery data in this period."}
                  </p>
                </div>
              </div>
            </ReportPanel>
          ) : null}

          {showTab("project_health") ? (
            <ReportPanel className="flex flex-col p-4">
              <PanelHeader title="Project Health" />
              <div className="mt-4 grid items-center gap-4 sm:grid-cols-[1fr_1fr]">
                <ReportDonut items={projectHealth} center={data.projects} caption="Projects" />
                <ReportLegend items={projectHealth} />
              </div>
              <div className="mt-4 border-t border-subtle pt-3">
                <div className="flex items-center justify-between text-[10px]">
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
                      className="flex items-center justify-between gap-3 py-2 text-[10px]"
                    >
                      <span className="truncate font-medium text-primary">{project.name}</span>
                      <span className="rounded-md bg-warning-subtle px-2 py-1 font-semibold text-warning-primary">
                        {project.completion}
                      </span>
                    </Link>
                  ))}
                  {!attentionProjects.length ? (
                    <p className="py-3 text-[10px] text-tertiary">No projects currently need attention.</p>
                  ) : null}
                </div>
              </div>
            </ReportPanel>
          ) : null}

          {showTab("pipeline") ? (
            <ReportPanel className="flex flex-col p-4">
              <PanelHeader title="Pipeline Overview" />
              <div className="mt-4 flex-1">
                <PipelineBars
                  items={data.opportunity_stages.map((stage) => ({ ...stage, value: stage.value }))}
                  total={data.commercial.opportunities}
                />
              </div>
              <div className="mt-4 grid grid-cols-2 divide-x divide-subtle rounded-lg bg-layer-1 p-3">
                <div className="pr-3">
                  <p className="text-[10px] text-secondary">Total Pipeline Value</p>
                  <p className="text-lg mt-1 font-semibold text-primary">{data.commercial.pipeline_value}</p>
                </div>
                <div className="pl-3">
                  <p className="text-[10px] text-secondary">Win Rate</p>
                  <p className="text-lg mt-1 font-semibold text-primary">
                    {percentage(wonOpportunities, data.commercial.opportunities)}%
                  </p>
                </div>
              </div>
            </ReportPanel>
          ) : null}
        </div>
      ) : null}

      {showTab("investment") || showTab("portfolio") ? (
        <div
          className={`mt-4 grid items-stretch gap-3 ${activeTab === "overview" ? "xl:grid-cols-[1.45fr_1fr]" : "grid-cols-1"}`}
        >
          {showTab("investment") ? (
            <ReportPanel className="overflow-hidden">
              <div className="p-4">
                <PanelHeader title="Investment Disbursement Progress" />
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[680px] text-left text-[10px]">
                  <thead className="border-y border-subtle bg-layer-1/40 text-secondary">
                    <tr>
                      {["Project", "Client", "Total Investment", "Disbursed", "Progress", "Next Disbursement"].map(
                        (label) => (
                          <th key={label} className="px-4 py-3 font-medium">
                            {label}
                          </th>
                        )
                      )}
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
              <div className="border-t border-subtle px-4 py-3 text-[10px] text-tertiary">
                No investment records available
              </div>
            </ReportPanel>
          ) : null}

          {showTab("portfolio") ? (
            <ReportPanel className="p-4">
              <PanelHeader
                title="Portfolio / Client Database"
                href={`/${workspaceSlug}/summon/clients/`}
                label="View all clients"
              />
              <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-2 2xl:grid-cols-4">
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
                <p className="text-[10px] font-semibold text-primary">Top Clients by Revenue (YTD)</p>
                <div className="mt-2 rounded-lg border border-dashed border-subtle py-10 text-center text-[10px] text-tertiary">
                  Revenue attribution is not configured for client records.
                </div>
              </div>
            </ReportPanel>
          ) : null}
        </div>
      ) : null}

      {activeTab === "overview" ? (
        <ReportPanel className="mt-4 p-4">
          <PanelHeader title="Recent Reports" />
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <a
              href={exportUrl}
              className="hover:border-accent-primary/50 flex min-w-0 items-center gap-3 rounded-lg border border-subtle p-3"
            >
              <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-accent-subtle text-accent-primary">
                <FileSpreadsheet className="size-4" />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-[11px] font-semibold text-primary">Current Portfolio Report</span>
                <span className="mt-1 block text-[10px] text-secondary">CSV · Live data</span>
              </span>
            </a>
            {["Project Health Report", "Pipeline Report", "Investment Report", "Client Performance Report"].map(
              (name) => (
                <div
                  key={name}
                  className="flex min-w-0 items-center gap-3 rounded-lg border border-dashed border-subtle p-3 opacity-70"
                >
                  <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-layer-1 text-tertiary">
                    <FileSpreadsheet className="size-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-[11px] font-semibold text-primary">{name}</span>
                    <span className="mt-1 block text-[10px] text-tertiary">Not generated</span>
                  </span>
                </div>
              )
            )}
          </div>
        </ReportPanel>
      ) : null}
    </section>
  );
}

function PanelHeader(props: { title: string; href?: string; label?: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h2 className="text-xs font-semibold text-primary">{props.title}</h2>
      {props.href ? (
        <Link href={props.href} className="inline-flex items-center gap-1 text-[10px] font-medium text-accent-primary">
          {props.label || "View detail"} <ArrowRight className="size-3" />
        </Link>
      ) : (
        <span className="inline-flex items-center gap-1 text-[10px] font-medium text-accent-primary">
          View detail <ArrowRight className="size-3" />
        </span>
      )}
    </div>
  );
}

function MiniMetric(props: { label: string; value: ReactNode; detail: string }) {
  return (
    <div className="rounded-lg border border-subtle p-3">
      <p className="text-[10px] text-secondary">{props.label}</p>
      <p className="text-lg mt-1 font-semibold text-primary">{props.value}</p>
      <p className="mt-1 truncate text-[9px] text-tertiary">{props.detail}</p>
    </div>
  );
}
