/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import React from "react";
import { TrendingUp } from "lucide-react";
import { KNOWLEDGE_STATS } from "./mock-data";
import type { IKnowledgeStats } from "./types";

interface IKnowledgeStatsCardProps {
  stats?: IKnowledgeStats;
}

export const KnowledgeStatsCard: React.FC<IKnowledgeStatsCardProps> = ({ stats = KNOWLEDGE_STATS }) => {
  return (
    <div className="shadow-xs flex flex-col rounded-xl border border-subtle bg-surface-1 p-4">
      <h2 className="text-xs mb-3 font-semibold text-primary">Knowledge Stats</h2>

      <div className="grid grid-cols-2 gap-4">
        {/* Total Articles */}
        <div>
          <span className="text-[11px] font-medium text-secondary">Total Articles</span>
          <p className="text-lg mt-1 font-bold tracking-tight text-primary">{stats.totalArticles}</p>
        </div>

        {/* Total Views */}
        <div>
          <span className="text-[11px] font-medium text-secondary">Total Views</span>
          <p className="text-lg mt-1 font-bold tracking-tight text-primary">{stats.totalViews}</p>
        </div>

        {/* Contributors */}
        <div>
          <span className="text-[11px] font-medium text-secondary">Contributors</span>
          <p className="text-lg mt-1 font-bold tracking-tight text-primary">{stats.contributors}</p>
        </div>

        {/* This Month */}
        <div>
          <span className="text-[11px] font-medium text-secondary">This Month</span>
          <div className="mt-1 flex items-center gap-1.5">
            <span className="text-lg font-bold tracking-tight text-primary">+{stats.thisMonthCount}</span>
            <span className="border-emerald-200 bg-emerald-50 text-emerald-600 dark:border-emerald-800/60 dark:bg-emerald-950/40 dark:text-emerald-400 inline-flex items-center gap-0.5 rounded-md border px-1.5 py-0.5 text-[10px] font-semibold">
              <TrendingUp size={10} />
              <span>{stats.thisMonthGrowthPercentage}%</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
