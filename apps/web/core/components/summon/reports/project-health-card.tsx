/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import React, { useState } from "react";
import { ChevronDown, ArrowRight, AlertTriangle } from "lucide-react";
import { PROJECT_HEALTH_DISTRIBUTION, TOP_ATTENTION_PROJECTS } from "./mock-data";

export function ProjectHealthCard() {
  const [filter, setFilter] = useState("By Health Score");

  return (
    <div className="shadow-sm flex h-full flex-col justify-between rounded-2xl border border-subtle bg-surface-1 p-5">
      <div>
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-primary">Project Health</h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setFilter((prev) => (prev === "By Health Score" ? "By Stage" : "By Health Score"))}
              className="text-xs inline-flex items-center gap-1 rounded-md border border-subtle bg-layer-1 px-2.5 py-1 font-medium text-secondary hover:text-primary"
            >
              {filter}
              <ChevronDown className="size-3.5" />
            </button>
            <button
              type="button"
              className="text-xs inline-flex items-center gap-1 font-medium text-accent-primary hover:underline"
            >
              View detail <ArrowRight className="size-3" />
            </button>
          </div>
        </div>

        <div className="mt-6 flex flex-col items-center justify-between gap-6 sm:flex-row sm:items-center">
          {/* Donut Chart */}
          <div className="relative flex size-36 shrink-0 items-center justify-center">
            <svg className="size-full -rotate-90" viewBox="0 0 100 100">
              <circle
                cx="50"
                cy="50"
                r="38"
                fill="none"
                stroke="currentColor"
                strokeWidth="12"
                className="text-layer-2"
              />
              {/* Excellent 34% (Emerald) */}
              <circle
                cx="50"
                cy="50"
                r="38"
                fill="none"
                stroke="#10B981"
                strokeWidth="12"
                strokeDasharray="81.1 238.7"
                strokeDashoffset="0"
                strokeLinecap="round"
              />
              {/* Good 41% (Blue) */}
              <circle
                cx="50"
                cy="50"
                r="38"
                fill="none"
                stroke="#3B82F6"
                strokeWidth="12"
                strokeDasharray="97.8 238.7"
                strokeDashoffset="-84"
                strokeLinecap="round"
              />
              {/* At Risk 19% (Amber) */}
              <circle
                cx="50"
                cy="50"
                r="38"
                fill="none"
                stroke="#F59E0B"
                strokeWidth="12"
                strokeDasharray="45.3 238.7"
                strokeDashoffset="-184"
                strokeLinecap="round"
              />
              {/* Critical 6% (Red) */}
              <circle
                cx="50"
                cy="50"
                r="38"
                fill="none"
                stroke="#EF4444"
                strokeWidth="12"
                strokeDasharray="14.3 238.7"
                strokeDashoffset="-231"
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute flex flex-col items-center text-center">
              <span className="text-2xl font-bold tracking-tight text-primary">32</span>
              <span className="text-[10px] font-medium text-secondary">Projects</span>
            </div>
          </div>

          {/* Legend Items */}
          <div className="flex w-full flex-1 flex-col gap-2">
            {PROJECT_HEALTH_DISTRIBUTION.map((item) => (
              <div key={item.label} className="text-xs flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="size-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="font-medium text-secondary">{item.label}</span>
                </div>
                <div className="flex items-center gap-1.5 font-semibold text-primary">
                  <span>{item.count}</span>
                  <span className="text-secondary">({item.percentage}%)</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Top Attention Needed */}
      <div className="mt-5 border-t border-subtle pt-3.5">
        <div className="text-xs flex items-center justify-between">
          <span className="font-semibold text-secondary">Top Attention Needed</span>
          <button type="button" className="font-medium text-accent-primary hover:underline">
            View all projects →
          </button>
        </div>
        <div className="mt-2 space-y-1.5">
          {TOP_ATTENTION_PROJECTS.map((project) => (
            <div
              key={project.name}
              className="text-xs flex items-center justify-between rounded-lg bg-layer-1 px-2.5 py-1.5 transition-colors hover:bg-layer-2"
            >
              <div className="flex items-center gap-2 truncate">
                <AlertTriangle
                  className={`size-3.5 shrink-0 ${project.status === "critical" ? "text-red-500" : "text-amber-500"}`}
                />
                <span className="truncate font-medium text-primary">{project.name}</span>
              </div>
              <span
                className={`rounded-md px-1.5 py-0.5 text-[11px] font-bold ${
                  project.status === "critical"
                    ? "bg-red-500/10 text-red-600 dark:text-red-400"
                    : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                }`}
              >
                {project.score}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
