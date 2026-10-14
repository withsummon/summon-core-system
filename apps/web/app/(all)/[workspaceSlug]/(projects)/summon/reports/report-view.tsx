/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import {
  AddressBookIcon,
  CoinsIcon,
  FunnelSimpleIcon,
  HeartbeatIcon,
  SquaresFourIcon,
  TrendUpIcon,
} from "@phosphor-icons/react";
import type { ISummonClient, ISummonReportFilters, ISummonReportSummary } from "@plane/types";
import { PageHead } from "@/components/core/page-title";
import { SummonRequestState } from "@/components/summon/request-state";
import { SummonPageHeader, summonPageClassName, ViewPanel } from "@/components/summon/screen";
import { SectionTabs } from "@/components/summon/section-tabs";
import type { TSectionTab } from "@/components/summon/section-tabs";
import { ReportFilters } from "./report-visuals";
import { useHashTab } from "@/components/summon/use-hash-tab";
import type { TReportFilterParam } from "./report-view-model";
import {
  CompanyProgressPanel,
  InvestmentPanel,
  PipelinePanel,
  PortfolioPanel,
  ProjectHealthPanel,
  RecentReportsPanel,
  ReportOverviewMetrics,
} from "./report-panels";

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

type TReportTab = "overview" | "company_progress" | "project_health" | "pipeline" | "investment" | "portfolio";

const REPORT_TABS: TSectionTab<TReportTab>[] = [
  { value: "overview", label: "Overview", icon: SquaresFourIcon },
  { value: "company_progress", label: "Company Progress", icon: TrendUpIcon },
  { value: "project_health", label: "Project Health", icon: HeartbeatIcon },
  { value: "pipeline", label: "Pipeline", icon: FunnelSimpleIcon },
  { value: "investment", label: "Investment Disbursement", icon: CoinsIcon },
  { value: "portfolio", label: "Portfolio / Client Database", icon: AddressBookIcon },
];

export function ReportView(props: TReportViewProps) {
  const { workspaceSlug, data, error, isLoading, filters, projects, clients, exportUrl, onFilterChange, onRetry } =
    props;
  const [activeTab, setActiveTab] = useHashTab(REPORT_TABS.map((tab) => tab.value));

  if (!data) {
    return (
      <div className="min-h-full p-4 lg:p-5">
        <PageHead title="Management & Reporting · Summon Core" />
        <SummonRequestState loading={isLoading} error={error} onRetry={onRetry} />
      </div>
    );
  }

  const isOverview = activeTab === "overview";

  return (
    <section className={summonPageClassName}>
      <PageHead title="Management & Reporting · Summon Core" />
      <SummonPageHeader
        title="Management & Reporting"
        description="Real-time insights and performance overview"
        actions={
          <ReportFilters
            filters={filters}
            projects={projects}
            clients={clients}
            exportUrl={exportUrl}
            onFilterChange={onFilterChange}
          />
        }
      />

      <SectionTabs items={REPORT_TABS} value={activeTab} onValueChange={setActiveTab} label="Report sections" />
      <ViewPanel value={activeTab}>
        {isOverview ? <ReportOverviewMetrics workspaceSlug={workspaceSlug} data={data} /> : null}

        <ReportDeliveryRow activeTab={activeTab} workspaceSlug={workspaceSlug} data={data} />
        <ReportPortfolioRow activeTab={activeTab} workspaceSlug={workspaceSlug} clients={clients} filters={filters} />

        {isOverview ? <RecentReportsPanel exportUrl={exportUrl} /> : null}
      </ViewPanel>
    </section>
  );
}

const isTabShown = (activeTab: TReportTab, tab: TReportTab) => activeTab === "overview" || activeTab === tab;

function ReportDeliveryRow(props: { activeTab: TReportTab; workspaceSlug: string; data: ISummonReportSummary }) {
  const { activeTab, workspaceSlug, data } = props;
  const showProgress = isTabShown(activeTab, "company_progress");
  const showHealth = isTabShown(activeTab, "project_health");
  const showPipeline = isTabShown(activeTab, "pipeline");
  if (!showProgress && !showHealth && !showPipeline) return null;
  return (
    <div
      className={`grid items-stretch gap-3 ${activeTab === "overview" ? "xl:grid-cols-[1fr_1fr_1.08fr]" : "grid-cols-1"}`}
    >
      {showProgress ? <CompanyProgressPanel data={data} /> : null}
      {showHealth ? <ProjectHealthPanel workspaceSlug={workspaceSlug} data={data} /> : null}
      {showPipeline ? <PipelinePanel workspaceSlug={workspaceSlug} data={data} /> : null}
    </div>
  );
}

function ReportPortfolioRow(props: {
  activeTab: TReportTab;
  workspaceSlug: string;
  clients: ISummonClient[];
  filters: ISummonReportFilters;
}) {
  const { activeTab, workspaceSlug, clients, filters } = props;
  const showInvestment = isTabShown(activeTab, "investment");
  const showPortfolio = isTabShown(activeTab, "portfolio");
  if (!showInvestment && !showPortfolio) return null;
  return (
    <div
      className={`grid items-stretch gap-3 ${activeTab === "overview" ? "xl:grid-cols-[1.45fr_1fr]" : "grid-cols-1"}`}
    >
      {showInvestment ? <InvestmentPanel /> : null}
      {showPortfolio ? <PortfolioPanel workspaceSlug={workspaceSlug} clients={clients} filters={filters} /> : null}
    </div>
  );
}
