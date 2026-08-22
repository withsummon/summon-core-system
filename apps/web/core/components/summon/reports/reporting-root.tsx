/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import React, { useState, useMemo } from "react";
import useSWR from "swr";
import {
  Calendar,
  Filter,
  Download,
  Bell,
  Maximize2,
  Settings as SettingsIcon,
  ChevronDown,
  FolderGit2,
  Users,
  Building,
} from "lucide-react";
import { useProject } from "@/hooks/store/use-project";
import { summonService } from "@/services/summon.service";
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

export function ReportingRoot({ workspaceSlug = "default" }: IReportingRootProps) {
  const { joinedProjectIds, getProjectById } = useProject();

  const { data: clients = [] } = useSWR(workspaceSlug ? ["summon-clients-reporting", workspaceSlug] : null, () =>
    summonService.listClients(workspaceSlug)
  );

  const projectsList = useMemo(
    () =>
      joinedProjectIds.map((id) => ({
        id,
        name: getProjectById(id)?.name || id,
        identifier: getProjectById(id)?.identifier || id,
      })),
    [joinedProjectIds, getProjectById]
  );

  const [activeTab, setActiveTab] = useState<TReportingTab>("Overview");
  const [dateRange, setDateRange] = useState("1 May 2025 - 31 May 2025");
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);

  // Scope filter state: workspace | project | client
  const [scopeFilter, setScopeFilter] = useState<"workspace" | "project" | "client">("workspace");
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [selectedClientId, setSelectedClientId] = useState<string>("");

  return (
    <div className="flex flex-col gap-6 p-6 lg:p-8">
      {/* Top Header */}
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-primary">Management & Reporting</h1>
          <p className="text-xs font-medium text-secondary">
            Multi-project analytics, client portfolio metrics, and document generation
          </p>
        </div>

        {/* Top Right Action Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Date Picker Button */}
          <div className="text-xs shadow-sm flex items-center gap-1.5 rounded-xl border border-subtle bg-surface-1 px-3 py-1.5 font-medium text-primary">
            <Calendar className="size-3.5 text-tertiary" />
            <span>{dateRange}</span>
            <ChevronDown className="size-3 text-tertiary" />
          </div>

          {/* Filters Button */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowFilterDropdown(!showFilterDropdown)}
              className="text-xs shadow-sm flex items-center gap-1.5 rounded-xl border border-subtle bg-surface-1 px-3 py-1.5 font-medium text-secondary hover:text-primary"
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
            <span>Export / Generate Document</span>
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

      {/* Scope Toolbar: Workspace-Wide vs Per-Project vs Per-Client */}
      <div className="shadow-xs flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-subtle bg-surface-1 p-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-secondary">Reporting Scope:</span>
          <div className="flex items-center rounded-xl border border-subtle bg-layer-1 p-0.5">
            <button
              type="button"
              onClick={() => setScopeFilter("workspace")}
              className={`text-xs flex items-center gap-1.5 rounded-lg px-3 py-1 font-bold transition-all ${
                scopeFilter === "workspace"
                  ? "shadow-xs bg-surface-1 font-bold text-accent-primary"
                  : "text-secondary hover:text-primary"
              }`}
            >
              <Building className="size-3.5" />
              Workspace Pulse
            </button>
            <button
              type="button"
              onClick={() => setScopeFilter("project")}
              className={`text-xs flex items-center gap-1.5 rounded-lg px-3 py-1 font-bold transition-all ${
                scopeFilter === "project"
                  ? "shadow-xs bg-surface-1 font-bold text-accent-primary"
                  : "text-secondary hover:text-primary"
              }`}
            >
              <FolderGit2 className="size-3.5" />
              Per Project
            </button>
            <button
              type="button"
              onClick={() => setScopeFilter("client")}
              className={`text-xs flex items-center gap-1.5 rounded-lg px-3 py-1 font-bold transition-all ${
                scopeFilter === "client"
                  ? "shadow-xs bg-surface-1 font-bold text-accent-primary"
                  : "text-secondary hover:text-primary"
              }`}
            >
              <Users className="size-3.5" />
              Per Client
            </button>
          </div>
        </div>

        {/* Project Selector when Scope is Project */}
        {scopeFilter === "project" && (
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-secondary">Target Project:</span>
            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="text-xs focus:border-accent-primary h-8 rounded-lg border border-subtle bg-layer-1 px-3 font-semibold text-primary focus:outline-none"
            >
              <option value="">All Projects</option>
              {projectsList.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.identifier})
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Client Selector when Scope is Client */}
        {scopeFilter === "client" && (
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-secondary">Target Client:</span>
            <select
              value={selectedClientId}
              onChange={(e) => setSelectedClientId(e.target.value)}
              className="text-xs focus:border-accent-primary h-8 rounded-lg border border-subtle bg-layer-1 px-3 font-semibold text-primary focus:outline-none"
            >
              <option value="">All Clients</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        )}
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
        defaultScope={scopeFilter}
        defaultProjectId={selectedProjectId}
        defaultClientId={selectedClientId}
      />
    </div>
  );
}
