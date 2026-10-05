/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */
import { ArrowRight } from "lucide-react";
import type { Doc } from "@summon/convex/data-model";
import { TypeIcon } from "./type-icon";
export function TopTemplatesRow({
  templates,
  disabled,
  onSelectTemplate,
  onViewAllTemplates,
}: {
  templates: Doc<"automationTemplates">[];
  disabled: boolean;
  onSelectTemplate: (template: Doc<"automationTemplates">) => void;
  onViewAllTemplates: () => void;
}) {
  return (
    <div className="w-full space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-primary">Create New</h2>
        <button
          type="button"
          onClick={onViewAllTemplates}
          className="text-xs flex items-center gap-1 font-medium text-accent-primary"
        >
          View all templates
          <ArrowRight size={13} />
        </button>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
        {templates.slice(0, 6).map((template) => (
          <button
            type="button"
            key={template._id}
            disabled={disabled || !template.isActive}
            onClick={() => onSelectTemplate(template)}
            className="group shadow-xs hover:border-blue-400 hover:shadow-md relative flex flex-col justify-between rounded-xl border border-subtle bg-surface-1 p-3.5 text-left transition-all disabled:opacity-50"
          >
            <div className="space-y-2.5">
              <TypeIcon type={template.type} boxed size={18} />
              <div>
                <h3 className="text-xs line-clamp-1 font-semibold text-primary">{template.name}</h3>
                <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-secondary">{template.description}</p>
              </div>
            </div>
            <div className="mt-3 flex justify-end">
              <ArrowRight size={14} />
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
