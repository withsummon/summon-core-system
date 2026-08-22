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

export const KnowledgeStatsCard: React.FC<IKnowledgeStatsCardProps> = ({
  stats = KNOWLEDGE_STATS,
}) => {
  return (
    <div className="flex flex-col rounded-xl border border-subtle bg-surface-1 p-4 shadow-xs">
      <h2 className="text-xs font-semibold text-primary mb-3">Knowledge Stats</h2>

      <div className="grid grid-cols-2 gap-4">
        {/* Total Articles */}
        <div>
          <span className="text-[11px] font-medium text-secondary">Total Articles</span>
          <p className="mt-1 text-lg font-bold text-primary tracking-tight">
            {stats.totalArticles}
          </p>
        </div>

        {/* Total Views */}
        <div>
          <span className="text-[11px] font-medium text-secondary">Total Views</span>
          <p className="mt-1 text-lg font-bold text-primary tracking-tight">
            {stats.totalViews}
          </p>
        </div>

        {/* Contributors */}
        <div>
          <span className="text-[11px] font-medium text-secondary">Contributors</span>
          <p className="mt-1 text-lg font-bold text-primary tracking-tight">
            {stats.contributors}
          </p>
        </div>

        {/* This Month */}
        <div>
          <span className="text-[11px] font-medium text-secondary">This Month</span>
          <div className="mt-1 flex items-center gap-1.5">
            <span className="text-lg font-bold text-primary tracking-tight">
              +{stats.thisMonthCount}
            </span>
            <span className="inline-flex items-center gap-0.5 rounded-md border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-600 dark:border-emerald-800/60 dark:bg-emerald-950/40 dark:text-emerald-400">
              <TrendingUp size={10} />
              <span>{stats.thisMonthGrowthPercentage}%</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
