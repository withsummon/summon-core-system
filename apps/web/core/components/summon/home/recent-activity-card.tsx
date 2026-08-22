/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import React from "react";
import Link from "next/link";
import { Activity, Clock, ArrowUpRight } from "lucide-react";
import type { ISummonHomeSummary } from "@plane/types";

interface IRecentActivityCardProps {
  recentActivity: ISummonHomeSummary["recent_activity"];
  workspaceSlug: string;
}

export function RecentActivityCard({ recentActivity }: IRecentActivityCardProps) {
  return (
    <div className="shadow-sm rounded-2xl border border-subtle bg-surface-1 p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex size-7 items-center justify-center rounded-lg">
            <Activity className="size-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-primary">Workspace Activity</h3>
            <p className="text-[11px] text-tertiary">Real-time updates and operational events</p>
          </div>
        </div>
      </div>

      <div className="mt-4 divide-y divide-subtle">
        {recentActivity.length > 0 ? (
          recentActivity.slice(0, 5).map((activity) => (
            <Link
              key={activity.id}
              href={activity.href}
              className="group flex items-center justify-between gap-3 rounded-xl px-2 py-2.5 transition-colors hover:bg-layer-1"
            >
              <div className="min-w-0">
                <p className="text-xs truncate font-semibold text-primary group-hover:text-accent-primary">
                  {activity.label}
                </p>
                <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-tertiary">
                  <Clock className="size-3" />
                  <time dateTime={activity.created_at}>{activity.created_at.slice(0, 10)}</time>
                </div>
              </div>
              <ArrowUpRight className="size-3.5 shrink-0 text-tertiary group-hover:text-accent-primary" />
            </Link>
          ))
        ) : (
          <div className="text-xs py-4 text-center text-tertiary">No recent activity logged.</div>
        )}
      </div>
    </div>
  );
}
