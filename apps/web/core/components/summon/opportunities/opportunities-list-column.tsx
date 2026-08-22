/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import React, { useState } from "react";
import { Star, MoreHorizontal, ChevronDown, Check } from "lucide-react";
import { cn } from "@plane/utils";
import type { IOpportunityItem } from "./types";

interface IOpportunitiesListColumnProps {
  opportunities: IOpportunityItem[];
  selectedOpportunityId: string;
  onSelectOpportunity: (id: string) => void;
  onToggleFavorite?: (id: string) => void;
}

const getAvatarBgClass = (color: string) => {
  switch (color) {
    case "blue":
      return "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300";
    case "purple":
      return "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300";
    case "green":
      return "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300";
    case "orange":
      return "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300";
    case "cyan":
      return "bg-cyan-100 text-cyan-700 dark:bg-cyan-950 dark:text-cyan-300";
    case "pink":
      return "bg-pink-100 text-pink-700 dark:bg-pink-950 dark:text-pink-300";
    default:
      return "bg-blue-100 text-blue-700";
  }
};

export const OpportunitiesListColumn: React.FC<IOpportunitiesListColumnProps> = ({
  opportunities,
  selectedOpportunityId,
  onSelectOpportunity,
  onToggleFavorite,
}) => {
  const [sortOption, setSortOption] = useState<string>("Recently Updated");
  const [isSortOpen, setIsSortOpen] = useState(false);

  return (
    <div className="flex flex-col rounded-xl border border-subtle bg-surface-1 shadow-xs overflow-hidden h-full">
      {/* Column Header */}
      <div className="flex items-center justify-between border-b border-subtle px-4 py-3 bg-surface-2/40">
        <div>
          <h2 className="text-xs font-semibold text-primary">All Opportunities</h2>
          <p className="text-[10px] text-secondary">{opportunities.length} opportunities</p>
        </div>

        {/* Sort Dropdown */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setIsSortOpen(!isSortOpen)}
            className="flex items-center gap-1 text-[11px] font-medium text-secondary hover:text-primary transition-colors"
          >
            <span>Sort: {sortOption}</span>
            <ChevronDown size={12} />
          </button>

          {isSortOpen && (
            <div className="absolute right-0 z-30 mt-1 w-40 rounded-lg border border-subtle bg-surface-1 py-1 shadow-lg text-left">
              {["Recently Updated", "Highest Value", "Alphabetical", "Close Date"].map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => {
                    setSortOption(opt);
                    setIsSortOpen(false);
                  }}
                  className={cn(
                    "flex w-full items-center justify-between px-3 py-1.5 text-[11px] hover:bg-surface-2 transition-colors",
                    sortOption === opt && "font-semibold text-blue-600 dark:text-blue-400"
                  )}
                >
                  <span>{opt}</span>
                  {sortOption === opt && <Check size={12} />}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Opportunity Items List */}
      <div className="divide-y divide-subtle overflow-y-auto max-h-[720px]">
        {opportunities.map((item) => {
          const isSelected = selectedOpportunityId === item.id;

          return (
            <div
              key={item.id}
              onClick={() => onSelectOpportunity(item.id)}
              className={cn(
                "group relative flex items-start gap-3 p-3.5 transition-all cursor-pointer",
                isSelected
                  ? "bg-blue-50/50 dark:bg-blue-950/30 border-l-3 border-blue-600"
                  : "hover:bg-surface-2/60"
              )}
            >
              {/* Avatar Initials Box */}
              <div
                className={cn(
                  "flex size-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold shadow-2xs",
                  getAvatarBgClass(item.avatarColor)
                )}
              >
                {item.initials}
              </div>

              {/* Title & Info */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-1">
                  <h3
                    className={cn(
                      "text-xs font-semibold truncate",
                      isSelected ? "text-blue-600 dark:text-blue-400" : "text-primary"
                    )}
                  >
                    {item.title}
                  </h3>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleFavorite?.(item.id);
                      }}
                      className={cn(
                        "rounded p-0.5 text-placeholder hover:text-amber-500 transition-colors",
                        item.isFavorite && "text-amber-500 fill-amber-500"
                      )}
                    >
                      <Star size={12} className={item.isFavorite ? "fill-amber-500" : ""} />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => e.stopPropagation()}
                      className="rounded p-0.5 text-placeholder hover:text-primary transition-colors"
                    >
                      <MoreHorizontal size={12} />
                    </button>
                  </div>
                </div>

                <p className="text-[11px] text-secondary truncate mt-0.5">{item.client}</p>

                <div className="mt-2 flex items-center justify-between text-[10px]">
                  <span className="rounded-full bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400 px-2 py-0.5 font-medium">
                    {item.stageBadgeText}
                  </span>
                  <span className="text-placeholder">{item.updatedAt}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
