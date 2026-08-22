/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import React, { useState } from "react";
import { ChevronDown, ArrowRight, DollarSign } from "lucide-react";
import { PIPELINE_STAGES } from "./mock-data";

export function PipelineOverviewCard() {
  const [filter, setFilter] = useState("By Stage");

  return (
    <div className="shadow-sm flex h-full flex-col justify-between rounded-2xl border border-subtle bg-surface-1 p-5">
      <div>
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-primary">Pipeline Overview</h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setFilter((prev) => (prev === "By Stage" ? "By Value" : "By Stage"))}
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

        {/* Horizontal Bars */}
        <div className="mt-4 space-y-2.5">
          {PIPELINE_STAGES.map((stage) => (
            <div key={stage.stage} className="space-y-1">
              <div className="text-xs flex items-center justify-between">
                <span className="font-medium text-secondary">{stage.stage}</span>
                <span className="font-semibold text-primary">
                  {stage.valueIdr} <span className="font-normal text-tertiary">({stage.percentage}%)</span>
                </span>
              </div>
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-layer-2">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.min(100, stage.percentage * 3.5)}%`,
                    backgroundColor: stage.color,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Summary Metrics Row */}
      <div className="mt-5 flex items-center justify-between rounded-xl border border-subtle bg-layer-1 p-3.5">
        <div className="flex items-center gap-3">
          <div className="bg-blue-500/10 text-blue-600 dark:text-blue-400 flex size-8 items-center justify-center rounded-lg">
            <DollarSign className="size-4.5" />
          </div>
          <div>
            <div className="text-[11px] font-medium text-secondary">Total Pipeline Value</div>
            <div className="text-base font-bold text-primary">IDR 37.6B</div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-[11px] font-medium text-secondary">Win Rate</div>
          <div className="text-base text-emerald-600 dark:text-emerald-400 font-bold">42%</div>
        </div>
      </div>
    </div>
  );
}
