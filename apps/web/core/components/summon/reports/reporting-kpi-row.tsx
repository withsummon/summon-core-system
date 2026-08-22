/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import React from "react";
import { FolderKanban, Target, ShieldCheck, Clock, TrendingUp } from "lucide-react";
import { REPORTING_KPIS } from "./mock-data";

export function ReportingKpiRow() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
      {REPORTING_KPIS.map((kpi) => {
        return (
          <div
            key={kpi.id}
            className="shadow-sm hover:border-accent-primary/40 hover:shadow-md flex flex-col justify-between rounded-2xl border border-subtle bg-surface-1 p-4 transition-all"
          >
            <div className="flex items-start justify-between gap-2">
              <span className="text-xs font-medium text-secondary">{kpi.label}</span>
              <div className="flex size-7 items-center justify-center rounded-lg bg-layer-1 text-tertiary">
                {kpi.type === "revenue" && <TrendingUp className="text-blue-500 size-4" />}
                {kpi.type === "projects" && <FolderKanban className="text-emerald-500 size-4" />}
                {kpi.type === "opportunities" && <Target className="text-indigo-500 size-4" />}
                {kpi.type === "health" && <ShieldCheck className="text-blue-500 size-4" />}
                {kpi.type === "tasks" && <Clock className="text-amber-500 size-4" />}
              </div>
            </div>

            <div className="mt-2 flex items-baseline justify-between gap-2">
              <span className="text-2xl font-bold tracking-tight text-primary">{kpi.value}</span>
              {kpi.type === "revenue" && (
                <div className="h-6 w-14">
                  <svg viewBox="0 0 60 24" className="h-full w-full overflow-visible">
                    <path
                      d="M2 18 Q 15 14, 25 16 T 45 6 T 58 4"
                      fill="none"
                      stroke="#3B82F6"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                    />
                  </svg>
                </div>
              )}
            </div>

            <div className="text-xs mt-2.5 flex items-center gap-1.5">
              {kpi.change && (
                <span
                  className={`inline-flex items-center font-medium ${
                    kpi.isPositive ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"
                  }`}
                >
                  {kpi.isPositive ? "▲" : "▼"} {kpi.change}
                </span>
              )}
              {kpi.subtext && (
                <span
                  className={`font-medium ${
                    kpi.subtext === "Good" ? "text-emerald-600 dark:text-emerald-400" : "text-secondary"
                  }`}
                >
                  {kpi.subtext}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
