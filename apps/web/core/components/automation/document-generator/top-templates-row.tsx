/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import React from "react";
import { ArrowRight } from "lucide-react";
import { TOP_TEMPLATES } from "./mock-data";
import { TypeIcon } from "./type-icon";
import type { TDocumentType } from "./types";

interface ITopTemplatesRowProps {
  onSelectTemplate?: (template: TDocumentType) => void;
  onViewAllTemplates?: () => void;
}

export const TopTemplatesRow: React.FC<ITopTemplatesRowProps> = ({ onSelectTemplate, onViewAllTemplates }) => {
  return (
    <div className="w-full space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-primary">Create New</h2>
        <button
          type="button"
          onClick={onViewAllTemplates}
          className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 flex items-center gap-1 font-medium transition-colors"
        >
          View all templates
          <ArrowRight size={13} />
        </button>
      </div>

      {/* Grid of Templates */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
        {TOP_TEMPLATES.map((tpl) => (
          <div
            key={tpl.id}
            onClick={() => onSelectTemplate?.(tpl.name)}
            className="group shadow-xs hover:border-blue-400 hover:shadow-md relative flex cursor-pointer flex-col justify-between rounded-xl border border-subtle bg-surface-1 p-3.5 transition-all duration-200 hover:-translate-y-0.5"
          >
            <div className="space-y-2.5">
              <TypeIcon type={tpl.name} boxed size={18} />
              <div>
                <h3 className="text-xs group-hover:text-blue-600 dark:group-hover:text-blue-400 line-clamp-1 font-semibold text-primary transition-colors">
                  {tpl.title}
                </h3>
                <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-secondary">{tpl.description}</p>
              </div>
            </div>
            <div className="mt-3 flex items-center justify-end">
              <ArrowRight
                size={14}
                className="group-hover:text-blue-600 dark:group-hover:text-blue-400 text-placeholder transition-transform duration-200 group-hover:translate-x-1"
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
