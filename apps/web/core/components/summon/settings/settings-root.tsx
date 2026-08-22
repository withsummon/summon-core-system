/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import React, { useState } from "react";
import { observer } from "mobx-react";
import { Search } from "lucide-react";
import { PageHead } from "@/components/core/page-title";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import { SettingsSidebarNav } from "./settings-sidebar-nav";
import { CompanyProfileCard } from "./company-profile-card";
import { PreferencesCard } from "./preferences-card";
import { WorkspaceMembersCard } from "./workspace-members-card";
import { PlanCard } from "./plan-card";
import { IntegrationsCard } from "./integrations-card";
import { SecuritySummaryCard } from "./security-summary-card";
import type { TSettingsSection } from "./types";

interface ISummonSettingsRootViewProps {
  workspaceSlug: string;
  workspaceName?: string;
}

export const SummonSettingsRootView: React.FC<ISummonSettingsRootViewProps> = observer(
  function SummonSettingsRootView({ workspaceSlug, workspaceName }) {
    const [activeSection, setActiveSection] = useState<TSettingsSection>("general");
    const [searchQuery, setSearchQuery] = useState("");

    const handleSelectSection = (section: TSettingsSection) => {
      setActiveSection(section);
      if (section !== "general") {
        setToast({
          type: TOAST_TYPE.INFO,
          title: "Settings Section",
          message: `Switched to ${section.replace("_", " ")} settings.`,
        });
      }
    };

    return (
      <div className="flex h-full w-full flex-col overflow-y-auto bg-canvas">
        <PageHead title={workspaceName ? `${workspaceName} - Settings` : "Settings"} />

        <div className="mx-auto w-full max-w-[1600px] space-y-5 p-5 md:p-6 lg:p-7">
          {/* Header */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-xl font-bold tracking-tight text-primary">Settings</h1>
              <p className="text-xs text-secondary mt-0.5">
                Manage your workspace, preferences, and system configurations.
              </p>
            </div>

            {/* Search Settings Input */}
            <div className="relative w-full sm:w-72">
              <div className="flex items-center rounded-xl border border-subtle bg-surface-1 px-3 py-1.5 shadow-2xs focus-within:border-blue-500 transition-all">
                <Search size={14} className="text-placeholder mr-2 shrink-0" />
                <input
                  type="text"
                  placeholder="Search settings..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-transparent text-xs text-primary placeholder:text-placeholder focus:outline-none"
                />
                <span className="hidden sm:inline-block rounded border border-subtle bg-surface-2 px-1.5 py-0.5 text-[9px] font-medium text-secondary">
                  ⌘ K
                </span>
              </div>
            </div>
          </div>

          {/* 3-Column Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            {/* Left Nav (approx 20% / 2.5 cols) */}
            <div className="lg:col-span-3 xl:col-span-2">
              <SettingsSidebarNav
                activeSection={activeSection}
                onSelectSection={handleSelectSection}
              />
            </div>

            {/* Middle Main Content Forms (approx 55% / 6.5 cols) */}
            <div className="lg:col-span-6 xl:col-span-7 space-y-5">
              <CompanyProfileCard />
              <PreferencesCard />
            </div>

            {/* Right Sidebar Info Cards (approx 25% / 3 cols) */}
            <div className="lg:col-span-3 xl:col-span-3 space-y-4">
              <WorkspaceMembersCard
                onManageMembers={() =>
                  setToast({
                    type: TOAST_TYPE.INFO,
                    title: "Members",
                    message: "Opening workspace membership modal.",
                  })
                }
              />
              <PlanCard />
              <IntegrationsCard
                onManageIntegrations={() =>
                  setActiveSection("integrations")
                }
              />
              <SecuritySummaryCard
                onManageSecurity={() =>
                  setActiveSection("security")
                }
              />
            </div>
          </div>
        </div>
      </div>
    );
  }
);
