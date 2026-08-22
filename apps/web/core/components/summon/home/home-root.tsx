/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import React from "react";
import useSWR from "swr";
import Link from "next/link";
import { Sparkles, Plus, FolderGit2, Users, FileText, ArrowRight } from "lucide-react";
import { useUser } from "@/hooks/store/user";
import { summonService } from "@/services/summon.service";
import { SummonRequestState } from "@/components/summon/request-state";
import { HomeKpiRow } from "./home-kpi-row";
import { PriorityWorkCard } from "./priority-work-card";
import { ActiveProjectsMatrix } from "./active-projects-matrix";
import { UpcomingMeetingsCard } from "./upcoming-meetings-card";
import { RecentActivityCard } from "./recent-activity-card";

interface IHomeRootProps {
  workspaceSlug: string;
}

export function HomeRoot({ workspaceSlug }: IHomeRootProps) {
  const { data: user } = useUser();
  const { data, error, isLoading, mutate } = useSWR(["summon-home", workspaceSlug], () =>
    summonService.getHomeSummary(workspaceSlug)
  );

  if (!data) {
    return <SummonRequestState loading={isLoading} error={error} onRetry={() => void mutate()} />;
  }

  const firstName = (user?.display_name || user?.first_name || "Leader").split(" ")[0];

  return (
    <div className="flex flex-col gap-6 p-6 lg:p-8">
      {/* Welcome Banner */}
      <div className="from-blue-500/10 via-indigo-500/5 to-purple-500/10 relative overflow-hidden rounded-3xl border border-subtle bg-gradient-to-r p-6 lg:p-8">
        <div className="relative z-10 flex flex-col justify-between gap-6 md:flex-row md:items-center">
          <div className="max-w-2xl">
            <div className="text-xs inline-flex items-center gap-1.5 rounded-full bg-accent-primary/10 px-3 py-1 font-semibold text-accent-primary">
              <Sparkles className="size-3.5" />
              <span>Summon Executive Pulse</span>
            </div>
            <h1 className="text-2xl md:text-3xl mt-2 font-bold tracking-tight text-primary">
              Welcome back, {firstName}!
            </h1>
            <p className="text-xs md:text-sm mt-1 text-secondary">
              Here is your multi-project delivery status, client health, and priority items across the workspace.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Link
              href={`/${workspaceSlug}/summon/opportunities/`}
              className="text-xs shadow-xs hover:border-accent-primary/40 flex items-center gap-1.5 rounded-xl border border-subtle bg-surface-1 px-4 py-2.5 font-bold text-primary hover:bg-layer-1"
            >
              <Users className="text-emerald-500 size-4" />
              <span>Opportunities</span>
            </Link>
            <Link
              href={`/${workspaceSlug}/summon/reports/`}
              className="text-xs shadow-xs flex items-center gap-1.5 rounded-xl bg-accent-primary px-4 py-2.5 font-bold text-white hover:bg-accent-primary/90"
            >
              <FileText className="size-4" />
              <span>Executive Reports</span>
              <ArrowRight className="size-3.5" />
            </Link>
          </div>
        </div>
      </div>

      {/* Top 4 KPI Metrics */}
      <HomeKpiRow counts={data.counts} priorityCount={data.priority.length} />

      {/* Main Grid: 2 Columns */}
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[1.4fr_1fr]">
        {/* Left Column: Priority Work + Active Projects Matrix */}
        <div className="flex flex-col gap-6">
          <PriorityWorkCard priorityIssues={data.priority} workspaceSlug={workspaceSlug} />
          <ActiveProjectsMatrix projects={data.projects} workspaceSlug={workspaceSlug} />
        </div>

        {/* Right Column: Upcoming Meetings + Recent Activity */}
        <div className="flex flex-col gap-6">
          <UpcomingMeetingsCard meetings={data.upcoming_meetings} workspaceSlug={workspaceSlug} />
          <RecentActivityCard recentActivity={data.recent_activity} workspaceSlug={workspaceSlug} />
        </div>
      </div>
    </div>
  );
}
