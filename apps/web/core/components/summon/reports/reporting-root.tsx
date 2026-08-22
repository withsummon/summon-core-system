/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import React, { useState } from "react";
import { Calendar, Filter, Download, Bell, Maximize2, Settings as SettingsIcon, ChevronDown } from "lucide-react";
import { ReportingKpiRow } from "./reporting-kpi-row";
import { CompanyProgressCard } from "./company-progress-card";
import { ProjectHealthCard } from "./project-health-card";
import { PipelineOverviewCard } from "./pipeline-overview-card";
import { DisbursementProgressCard } from "./disbursement-progress-card";
import { ClientPortfolioCard } from "./client-portfolio-card";
import { RecentReportsRow } from "./recent-reports-row";
import { ReportExportModal } from "./report-export-modal";
import type { TReportingTab } from "./types";

interface IReportingRootProps {
  workspaceSlug?: string;
}

const TABS: TReportingTab[] = [
  "Overview",
  "Company Progress",
  "Project Health",
  "Pipeline",
  "Investment Disbursement",
  "Portfolio / Client Database",
];

export function ReportingRoot({ workspaceSlug }: IReportingRootProps) {
  const [activeTab, setActiveTab] = useState<TReportingTab>("Overview");
  const [dateRange, setDateRange] = useState("1 May 2025 - 31 May 2025");
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);

  return (
    <div className="flex flex-col gap-6 p-6 lg:p-8">
      {/* Top Header */}
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-primary">Management & Reporting</h1>
          <p className="text-xs font-medium text-secondary">Real-time insights and performance overview</p>
        </div>

        {/* Top Right Action Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Date Picker Button */}
          <div className="text-xs shadow-sm hover:border-accent-primary/40 flex items-center gap-1.5 rounded-xl border border-subtle bg-surface-1 px-3 py-1.5 font-medium text-primary">
            <Calendar className="size-3.5 text-tertiary" />
            <span>{dateRange}</span>
            <ChevronDown className="size-3 text-tertiary" />
          </div>

          {/* Filters Button */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowFilterDropdown(!showFilterDropdown)}
              className="text-xs shadow-sm hover:border-accent-primary/40 flex items-center gap-1.5 rounded-xl border border-subtle bg-surface-1 px-3 py-1.5 font-medium text-secondary hover:text-primary"
            >
              <Filter className="size-3.5" />
              <span>Filters</span>
              <ChevronDown className="size-3" />
            </button>

            {showFilterDropdown && (
              <div className="shadow-xl absolute right-0 z-30 mt-2 w-56 rounded-xl border border-subtle bg-surface-1 p-2">
                <div className="px-2 py-1 text-[11px] font-semibold text-tertiary">Quick Date Presets</div>
                {["Today", "This Week", "1 May 2025 - 31 May 2025", "Last Quarter", "Year to Date (2025)"].map(
                  (range) => (
                    <button
                      key={range}
                      type="button"
                      onClick={() => {
                        setDateRange(range);
                        setShowFilterDropdown(false);
                      }}
                      className="text-xs flex w-full rounded-lg px-2.5 py-1.5 text-left text-secondary hover:bg-layer-1 hover:text-primary"
                    >
                      {range}
                    </button>
                  )
                )}
              </div>
            )}
          </div>

          {/* Export Report Button */}
          <button
            type="button"
            onClick={() => setIsExportModalOpen(true)}
            className="text-xs shadow-sm flex items-center gap-1.5 rounded-xl bg-accent-primary px-3.5 py-1.5 font-semibold text-white transition-all hover:bg-accent-primary/90"
          >
            <Download className="size-3.5" />
            <span>Export Report</span>
          </button>

          {/* Utility Quick Icons */}
          <div className="flex items-center gap-1 border-l border-subtle pl-2">
            <button
              type="button"
              className="flex size-8 items-center justify-center rounded-lg text-secondary hover:bg-layer-1 hover:text-primary"
              title="Notifications"
            >
              <Bell className="size-4" />
            </button>
            <button
              type="button"
              className="flex size-8 items-center justify-center rounded-lg text-secondary hover:bg-layer-1 hover:text-primary"
              title="Fullscreen"
            >
              <Maximize2 className="size-4" />
            </button>
            <button
              type="button"
              className="flex size-8 items-center justify-center rounded-lg text-secondary hover:bg-layer-1 hover:text-primary"
              title="Report Settings"
            >
              <SettingsIcon className="size-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Sub-tab Navigation */}
      <div className="flex overflow-x-auto border-b border-subtle">
        <div className="flex gap-6 pb-2">
          {TABS.map((tab) => {
            const isActive = activeTab === tab;
            return (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`text-xs relative font-semibold whitespace-nowrap transition-all ${
                  isActive ? "font-bold text-primary" : "text-secondary hover:text-primary"
                }`}
              >
                {tab}
                {isActive && (
                  <span className="absolute right-0 -bottom-2 left-0 h-0.5 rounded-full bg-accent-primary" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Top 5 KPI Metrics */}
      <ReportingKpiRow />

      {/* Middle Row: 3 Wide Cards */}
      {(activeTab === "Overview" ||
        activeTab === "Company Progress" ||
        activeTab === "Project Health" ||
        activeTab === "Pipeline") && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <CompanyProgressCard />
          <ProjectHealthCard />
          <PipelineOverviewCard />
        </div>
      )}

      {/* Lower Row: 2 Split Cards */}
      {(activeTab === "Overview" ||
        activeTab === "Investment Disbursement" ||
        activeTab === "Portfolio / Client Database") && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <DisbursementProgressCard />
          <ClientPortfolioCard workspaceSlug={workspaceSlug} />
        </div>
      )}

      {/* Bottom Row: Recent Reports */}
      <RecentReportsRow onOpenExportModal={() => setIsExportModalOpen(true)} />

      {/* Custom Document & Report Generator Modal */}
      <ReportExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        workspaceSlug={workspaceSlug}
      />
    </div>
  );
}
