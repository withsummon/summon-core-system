/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import React from "react";
import { cn } from "@plane/utils";
import { PIPELINE_STAGES } from "./mock-data";
import type { TPipelineStage } from "./types";

interface IPipelineStageFilterProps {
  selectedStage: TPipelineStage;
  onSelectStage: (stage: TPipelineStage) => void;
  stageCounts?: Record<TPipelineStage, number>;
}

const getDotClass = (color: string) => {
  switch (color) {
    case "blue":
      return "bg-blue-500";
    case "green":
      return "bg-emerald-500";
    case "purple":
      return "bg-purple-500";
    case "orange":
      return "bg-orange-500";
    case "slate":
      return "bg-slate-400";
    case "emerald":
      return "bg-emerald-600";
    case "red":
      return "bg-red-500";
    default:
      return "bg-blue-500";
  }
};

export const PipelineStageFilter: React.FC<IPipelineStageFilterProps> = ({
  selectedStage,
  onSelectStage,
  stageCounts,
}) => {
  return (
    <div className="shadow-xs flex flex-col rounded-xl border border-subtle bg-surface-1 p-3.5">
      <h2 className="text-xs mb-2.5 px-2 font-semibold text-primary">Pipeline</h2>

      <div className="space-y-0.5">
        {PIPELINE_STAGES.map((item) => {
          const isSelected = selectedStage === item.stage;
          const count = stageCounts ? (stageCounts[item.stage] ?? item.count) : item.count;

          return (
            <button
              key={item.stage}
              type="button"
              onClick={() => onSelectStage(item.stage)}
              className={cn(
                "text-xs flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left font-medium transition-colors",
                isSelected
                  ? "bg-blue-50/80 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400 font-semibold"
                  : "text-secondary hover:bg-surface-2 hover:text-primary"
              )}
            >
              <div className="flex items-center gap-2 truncate">
                {item.stage !== "All" && (
                  <span className={cn("size-2 shrink-0 rounded-full", getDotClass(item.color))} />
                )}
                <span className="truncate">{item.stage === "All" ? "All Opportunities" : item.stage}</span>
              </div>

              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-[10px] font-medium",
                  isSelected ? "bg-blue-600 dark:bg-blue-500 text-white" : "bg-layer-2 text-secondary"
                )}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
