/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import React from "react";
import { ArrowRight } from "lucide-react";
import { cn } from "@plane/utils";
import { RECENT_ACTIVITIES } from "./mock-data";
import type { IRecentActivity } from "./types";

interface IRecentActivityCardProps {
  activities?: IRecentActivity[];
  onViewAllActivity?: () => void;
}

const getDotColorClass = (color: string) => {
  switch (color) {
    case "green":
      return "bg-emerald-500 ring-emerald-100 dark:ring-emerald-950";
    case "purple":
      return "bg-purple-500 ring-purple-100 dark:ring-purple-950";
    case "cyan":
      return "bg-cyan-500 ring-cyan-100 dark:ring-cyan-950";
    case "orange":
      return "bg-orange-500 ring-orange-100 dark:ring-orange-950";
    case "blue":
    default:
      return "bg-blue-500 ring-blue-100 dark:ring-blue-950";
  }
};

export const RecentActivityCard: React.FC<IRecentActivityCardProps> = ({
  activities = RECENT_ACTIVITIES,
  onViewAllActivity,
}) => {
  return (
    <div className="flex flex-col rounded-xl border border-subtle bg-surface-1 p-5 shadow-xs">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-primary">Recent Activity</h2>
        <button
          type="button"
          onClick={onViewAllActivity}
          className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
        >
          <span>View all activity</span>
          <ArrowRight size={13} />
        </button>
      </div>

      {/* Activity Timeline */}
      <div className="mt-4 space-y-4">
        {activities.map((act, index) => {
          const isLast = index === activities.length - 1;

          return (
            <div key={act.id} className="relative flex items-start gap-3 pl-1">
              {/* Connecting Line */}
              {!isLast && (
                <div className="absolute left-[7px] top-[14px] h-[calc(100%+8px)] w-[1.5px] bg-subtle" />
              )}

              {/* Dot */}
              <div
                className={cn(
                  "relative z-10 mt-1 size-2.5 shrink-0 rounded-full ring-4 transition-transform",
                  getDotColorClass(act.color)
                )}
              />

              {/* Content */}
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-primary leading-tight hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer truncate">
                  {act.title}
                </p>
                <p className="text-[11px] text-secondary mt-0.5">{act.author}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
