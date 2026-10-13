/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import React from "react";
import { Folder, Users, Target, Settings, Building, ArrowRight } from "lucide-react";
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
        iconClass: "text-label-indigo-icon",
        boxClass: "bg-label-indigo-bg border-label-indigo-border",
      };
    case "clients":
      return {
        icon: Users,
        iconClass: "text-label-grey-icon",
        boxClass: "bg-label-grey-bg border-label-grey-border",
      };
    case "opportunities":
      return {
        icon: Target,
        iconClass: "text-label-purple-icon",
        boxClass: "bg-label-purple-bg border-label-purple-border",
      };
    case "processes":
      return {
        icon: Settings,
        iconClass: "text-label-emerald-icon",
        boxClass: "bg-label-emerald-bg border-label-emerald-border",
      };
    case "company":
    default:
      return {
        icon: Building,
        iconClass: "text-label-orange-icon",
        boxClass: "bg-label-orange-bg border-label-orange-border",
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
          <p className="mt-0.5 text-xs text-secondary">Access knowledge organized by your work context</p>
        </div>
        <button
          type="button"
          onClick={onViewAllContexts}
          className="flex items-center gap-1 text-xs font-medium text-link-primary transition-colors hover:text-link-primary-hover"
        >
          <span>View all contexts</span>
          <ArrowRight size={13} />
        </button>
      </div>

      {/* Grid of 5 Context Cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
        {KNOWLEDGE_CONTEXT_CARDS.map((card) => {
          const { icon: IconComponent, iconClass, boxClass } = getContextIcon(card.iconType);
          const isSelected = selectedContext === card.name;

          return (
            <button
              type="button"
              key={card.id}
              onClick={() => onSelectContext?.(card.name)}
              aria-pressed={isSelected}
              className={cn(
                "group flex cursor-pointer flex-col justify-between rounded-xl border bg-surface-1 p-3.5 text-left shadow-2xs transition-[translate,border-color,background-color,box-shadow] duration-200 hover:-translate-y-0.5 hover:border-accent-strong hover:shadow-md focus-visible:outline-2 focus-visible:outline-accent-strong focus-visible:outline-solid",
                isSelected ? "border-accent-strong bg-accent-subtle ring-2 ring-accent-subtle" : "border-subtle"
              )}
            >
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <div
                    className={cn("flex size-8.5 items-center justify-center rounded-lg border", boxClass, iconClass)}
                  >
                    <IconComponent size={17} strokeWidth={2} />
                  </div>
                  <span className="rounded-full bg-layer-2 px-2 py-0.5 text-[11px] font-medium text-secondary">
                    {card.count}
                  </span>
                </div>

                <div>
                  <h3 className="text-xs font-semibold text-primary transition-colors group-hover:text-accent-primary">
                    {card.title}
                  </h3>
                  <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-secondary">{card.description}</p>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
