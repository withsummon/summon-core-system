/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import React from "react";
import {
  Folder,
  Users,
  Target,
  Settings,
  Building,
  ArrowRight,
} from "lucide-react";
import { cn } from "@plane/utils";
import { KNOWLEDGE_CONTEXT_CARDS } from "./mock-data";
import type { TContextCategory } from "./types";

interface IBrowseContextsRowProps {
  selectedContext?: string;
  onSelectContext?: (ctx: TContextCategory) => void;
  onViewAllContexts?: () => void;
}

const getContextIcon = (type: string) => {
  switch (type) {
    case "projects":
      return {
        icon: Folder,
        iconClass: "text-blue-600 dark:text-blue-400",
        boxClass: "bg-blue-50 border-blue-200 dark:bg-blue-950/40 dark:border-blue-900/60",
      };
    case "clients":
      return {
        icon: Users,
        iconClass: "text-slate-700 dark:text-slate-300",
        boxClass: "bg-slate-100 border-slate-200 dark:bg-slate-800/60 dark:border-slate-700/60",
      };
    case "opportunities":
      return {
        icon: Target,
        iconClass: "text-purple-600 dark:text-purple-400",
        boxClass: "bg-purple-50 border-purple-200 dark:bg-purple-950/40 dark:border-purple-900/60",
      };
    case "processes":
      return {
        icon: Settings,
        iconClass: "text-blue-600 dark:text-blue-400",
        boxClass: "bg-blue-50 border-blue-200 dark:bg-blue-950/40 dark:border-blue-900/60",
      };
    case "company":
    default:
      return {
        icon: Building,
        iconClass: "text-blue-600 dark:text-blue-400",
        boxClass: "bg-blue-50 border-blue-200 dark:bg-blue-950/40 dark:border-blue-900/60",
      };
  }
};

export const BrowseContextsRow: React.FC<IBrowseContextsRowProps> = ({
  selectedContext,
  onSelectContext,
  onViewAllContexts,
}) => {
  return (
    <div className="w-full space-y-3">
      {/* Section Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-primary">Browse by Context</h2>
          <p className="text-xs text-secondary mt-0.5">
            Access knowledge organized by your work context
          </p>
        </div>
        <button
          type="button"
          onClick={onViewAllContexts}
          className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
        >
          <span>View all contexts</span>
          <ArrowRight size={13} />
        </button>
      </div>

      {/* Grid of 5 Context Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {KNOWLEDGE_CONTEXT_CARDS.map((card) => {
          const { icon: IconComponent, iconClass, boxClass } = getContextIcon(card.iconType);
          const isSelected = selectedContext === card.name;

          return (
            <div
              key={card.id}
              onClick={() => onSelectContext?.(card.name)}
              className={cn(
                "group flex flex-col justify-between rounded-xl border bg-surface-1 p-3.5 shadow-2xs transition-all duration-200 hover:-translate-y-0.5 hover:border-blue-400 hover:shadow-md cursor-pointer",
                isSelected ? "border-blue-500 ring-2 ring-blue-500/20 bg-blue-50/20 dark:bg-blue-950/20" : "border-subtle"
              )}
            >
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <div
                    className={cn(
                      "flex size-8.5 items-center justify-center rounded-lg border",
                      boxClass,
                      iconClass
                    )}
                  >
                    <IconComponent size={17} strokeWidth={2} />
                  </div>
                  <span className="rounded-full bg-layer-2 px-2 py-0.5 text-[11px] font-medium text-secondary">
                    {card.count}
                  </span>
                </div>

                <div>
                  <h3 className="text-xs font-semibold text-primary group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                    {card.title}
                  </h3>
                  <p className="mt-1 text-[11px] leading-relaxed text-secondary line-clamp-2">
                    {card.description}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
