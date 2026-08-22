/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import React from "react";
import { Flame, Eye, ArrowRight } from "lucide-react";
import { cn } from "@plane/utils";
import { POPULAR_KNOWLEDGE } from "./mock-data";
import type { IPopularKnowledgeItem } from "./types";

interface IPopularKnowledgeCardProps {
  items?: IPopularKnowledgeItem[];
  onSelectItem?: (item: IPopularKnowledgeItem) => void;
  onViewAllPopular?: () => void;
}

const getFireColor = (color: string) => {
  switch (color) {
    case "red":
      return "text-red-500";
    case "orange":
      return "text-orange-500";
    case "green":
      return "text-emerald-500";
    case "blue":
    default:
      return "text-blue-500";
  }
};

export const PopularKnowledgeCard: React.FC<IPopularKnowledgeCardProps> = ({
  items = POPULAR_KNOWLEDGE,
  onSelectItem,
  onViewAllPopular,
}) => {
  return (
    <div className="flex flex-col rounded-xl border border-subtle bg-surface-1 p-4 shadow-xs">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xs font-semibold text-primary">Popular Knowledge</h2>
        <button
          type="button"
          onClick={onViewAllPopular}
          className="flex items-center gap-1 text-[11px] font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
        >
          <span>View all</span>
          <ArrowRight size={12} />
        </button>
      </div>

      {/* List */}
      <div className="space-y-2.5">
        {items.map((item) => (
          <div
            key={item.id}
            onClick={() => onSelectItem?.(item)}
            className="group flex items-center justify-between gap-2 rounded-lg p-1.5 hover:bg-surface-2 transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-2 min-w-0">
              <Flame
                size={15}
                className={cn("shrink-0", getFireColor(item.fireColor))}
              />
              <span className="text-xs font-medium text-primary group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors truncate">
                {item.title}
              </span>
            </div>

            <div className="flex items-center gap-1 shrink-0 text-secondary">
              <Eye size={12} className="text-placeholder" />
              <span className="text-[11px] font-medium">{item.views}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
