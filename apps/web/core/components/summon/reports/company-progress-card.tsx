/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import React, { useState } from "react";
import { ChevronDown, Sparkles, ArrowRight } from "lucide-react";
import { COMPANY_PROGRESS_BREAKDOWN } from "./mock-data";

export function CompanyProgressCard() {
  const [filter, setFilter] = useState("Overall Progress");

  return (
    <div className="shadow-sm flex h-full flex-col justify-between rounded-2xl border border-subtle bg-surface-1 p-5">
      <div>
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-primary">Company Progress</h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setFilter((prev) => (prev === "Overall Progress" ? "By Quarter" : "Overall Progress"))}
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
              {/* Background circle */}
              <circle
                cx="50"
                cy="50"
                r="38"
                fill="none"
                stroke="currentColor"
                strokeWidth="12"
                className="text-layer-2"
              />
              {/* On Track Segment 72% */}
              <circle
                cx="50"
                cy="50"
                r="38"
                fill="none"
                stroke="#3B82F6"
                strokeWidth="12"
                strokeDasharray="171.8 238.7"
                strokeDashoffset="0"
                strokeLinecap="round"
              />
              {/* At Risk Segment 18% */}
              <circle
                cx="50"
                cy="50"
                r="38"
                fill="none"
                stroke="#6366F1"
                strokeWidth="12"
                strokeDasharray="43 238.7"
                strokeDashoffset="-175"
                strokeLinecap="round"
              />
              {/* Delayed Segment 8% */}
              <circle
                cx="50"
                cy="50"
                r="38"
                fill="none"
                stroke="#06B6D4"
                strokeWidth="12"
                strokeDasharray="19 238.7"
                strokeDashoffset="-220"
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute flex flex-col items-center text-center">
              <span className="text-2xl font-bold tracking-tight text-primary">72%</span>
              <span className="text-[10px] font-medium text-secondary">Overall Progress</span>
            </div>
          </div>

          {/* Legend Items */}
          <div className="flex w-full flex-1 flex-col gap-2.5">
            {COMPANY_PROGRESS_BREAKDOWN.map((item) => (
              <div key={item.label} className="text-xs flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="size-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="font-medium text-secondary">{item.label}</span>
                </div>
                <div className="flex items-center gap-2 font-semibold text-primary">
                  <span>{item.valueIdr}</span>
                  <span className="text-secondary">({item.percentage}%)</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Summon Insight */}
      <div className="border-blue-500/20 bg-blue-500/5 text-xs text-blue-700 dark:text-blue-300 mt-5 flex items-center gap-2.5 rounded-xl border p-3">
        <Sparkles className="text-blue-500 size-4 shrink-0" />
        <p className="font-medium">
          <span className="text-blue-800 dark:text-blue-200 font-semibold">Summon Insight:</span> Company progress is on
          track. 3 projects need attention.
        </p>
      </div>
    </div>
  );
}
