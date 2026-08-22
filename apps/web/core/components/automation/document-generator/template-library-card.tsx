/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import React from "react";
import { ArrowRight } from "lucide-react";
import { TEMPLATE_LIBRARY } from "./mock-data";
import { TypeIcon } from "./type-icon";
import type { TDocumentType } from "./types";

interface ITemplateLibraryCardProps {
  onSelectTemplate?: (tpl: TDocumentType) => void;
  onViewAllTemplates?: () => void;
}

export const TemplateLibraryCard: React.FC<ITemplateLibraryCardProps> = ({
  onSelectTemplate,
  onViewAllTemplates,
}) => {
  return (
    <div className="flex flex-col rounded-xl border border-subtle bg-surface-1 p-5 shadow-xs">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-primary">Template Library</h2>
        <button
          type="button"
          onClick={onViewAllTemplates}
          className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
        >
          <span>View all templates</span>
          <ArrowRight size={13} />
        </button>
      </div>

      {/* Grid of 4 cards */}
      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {TEMPLATE_LIBRARY.map((item) => (
          <div
            key={item.id}
            onClick={() => onSelectTemplate?.(item.name)}
            className="group flex flex-col justify-between rounded-xl border border-subtle bg-surface-2/60 p-3.5 transition-all duration-200 hover:-translate-y-0.5 hover:border-blue-400 hover:bg-surface-1 hover:shadow-md cursor-pointer"
          >
            <div className="space-y-2">
              <TypeIcon type={item.name} boxed size={16} />
              <div>
                <h3 className="text-xs font-semibold text-primary group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                  {item.title}
                </h3>
                <p className="mt-1 text-[11px] leading-snug text-secondary line-clamp-2">
                  {item.description}
                </p>
              </div>
            </div>
            {item.lastUsed && (
              <p className="mt-3 text-[10px] font-medium text-placeholder">
                {item.lastUsed}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
