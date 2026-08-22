/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import React from "react";
import { FolderGit2, CheckSquare, Users, TrendingUp, AlertTriangle } from "lucide-react";

interface IHomeKpiRowProps {
  counts: {
    projects: number;
    issues: number;
    clients: number;
    opportunities: number;
  };
  priorityCount: number;
}

export function HomeKpiRow({ counts, priorityCount }: IHomeKpiRowProps) {
  const kpis = [
    {
      label: "Active Projects",
      value: counts.projects,
      subtext: "Delivery workspaces",
      icon: <FolderGit2 className="text-blue-500 size-4.5" />,
      bg: "bg-blue-500/10",
    },
    {
      label: "Open Work Items",
      value: counts.issues,
      subtext: `${priorityCount} priority attention`,
      icon: <CheckSquare className="text-indigo-500 size-4.5" />,
      bg: "bg-indigo-500/10",
      highlight: priorityCount > 0 ? "text-amber-600 dark:text-amber-400" : undefined,
    },
    {
      label: "Client Accounts",
      value: counts.clients,
      subtext: "Commercial relationships",
      icon: <Users className="text-emerald-500 size-4.5" />,
      bg: "bg-emerald-500/10",
    },
    {
      label: "Pipeline Deals",
      value: counts.opportunities,
      subtext: "Active opportunities",
      icon: <TrendingUp className="text-purple-500 size-4.5" />,
      bg: "bg-purple-500/10",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
      {kpis.map((kpi) => (
        <div
          key={kpi.label}
          className="shadow-sm hover:border-accent-primary/30 hover:shadow-md flex flex-col justify-between rounded-2xl border border-subtle bg-surface-1 p-4 transition-all"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-secondary">{kpi.label}</span>
            <div className={`flex size-8 items-center justify-center rounded-xl ${kpi.bg}`}>{kpi.icon}</div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold tracking-tight text-primary">{kpi.value}</div>
            <div className="mt-1 flex items-center gap-1.5 text-[11px] font-medium text-tertiary">{kpi.subtext}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
