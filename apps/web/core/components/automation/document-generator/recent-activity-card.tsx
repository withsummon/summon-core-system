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
      return "bg-label-emerald-bg-strong ring-label-emerald-bg";
    case "purple":
      return "bg-label-purple-bg-strong ring-label-purple-bg";
    case "cyan":
      return "bg-label-yellow-bg-strong ring-label-yellow-bg";
    case "orange":
      return "bg-label-orange-bg-strong ring-label-orange-bg";
    case "blue":
    default:
      return "bg-label-indigo-bg-strong ring-label-indigo-bg";
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
          className="flex items-center gap-1 text-xs font-medium text-link-primary transition-colors hover:text-link-primary-hover"
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
                <div className="absolute top-[14px] left-[7px] h-[calc(100%+8px)] w-[1.5px] bg-(--border-color-subtle)" />
              )}

              {/* Dot */}
              <div
                className={cn("relative z-10 mt-1 size-2.5 shrink-0 rounded-full ring-4", getDotColorClass(act.color))}
              />

              {/* Content */}
              <div className="min-w-0 flex-1">
                <p
                  className="cursor-pointer truncate text-xs leading-tight font-medium text-primary transition-colors hover:text-accent-primary"
                  title={act.title}
                >
                  {act.title}
                </p>
                <p className="mt-0.5 text-[11px] text-secondary">{act.author}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
