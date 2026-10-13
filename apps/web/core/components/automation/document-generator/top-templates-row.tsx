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
          className="flex items-center gap-1 text-xs font-medium text-link-primary transition-colors hover:text-link-primary-hover"
        >
          View all templates
          <ArrowRight size={13} />
        </button>
      </div>

      {/* Grid of Templates */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
        {TOP_TEMPLATES.map((tpl) => (
          <button
            type="button"
            key={tpl.id}
            onClick={() => onSelectTemplate?.(tpl.name)}
            className="group relative flex cursor-pointer flex-col justify-between rounded-xl border border-subtle bg-surface-1 p-3.5 text-left shadow-xs transition-[translate,border-color,box-shadow] duration-200 hover:-translate-y-0.5 hover:border-accent-strong hover:shadow-md focus-visible:outline-2 focus-visible:outline-accent-strong focus-visible:outline-solid"
          >
            <div className="space-y-2.5">
              <TypeIcon type={tpl.name} boxed size={18} />
              <div>
                <h3 className="line-clamp-1 text-xs font-semibold text-primary transition-colors group-hover:text-accent-primary">
                  {tpl.title}
                </h3>
                <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-secondary">{tpl.description}</p>
              </div>
            </div>
            <div className="mt-3 flex items-center justify-end">
              <ArrowRight
                size={14}
                className="text-placeholder transition-[translate] duration-200 group-hover:translate-x-1 group-hover:text-accent-primary"
              />
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};
