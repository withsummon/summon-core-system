/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */
import { ArrowRight } from "lucide-react";
import type { Doc } from "@summon/convex/data-model";
import { TypeIcon } from "./type-icon";
export function TemplateLibraryCard({
  templates,
  expanded,
  disabled,
  onSelectTemplate,
  onViewAllTemplates,
}: {
  templates: Doc<"automationTemplates">[];
  expanded: boolean;
  disabled: boolean;
  onSelectTemplate: (template: Doc<"automationTemplates">) => void;
  onViewAllTemplates: () => void;
}) {
  return (
    <div className="shadow-xs flex flex-col rounded-xl border border-subtle bg-surface-1 p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-primary">Template Library</h2>
        <button
          type="button"
          onClick={onViewAllTemplates}
          className="text-xs flex items-center gap-1 font-medium text-accent-primary"
        >
          View all templates
          <ArrowRight size={13} />
        </button>
      </div>
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {(expanded ? templates : templates.slice(0, 4)).map((template) => (
          <button
            type="button"
            key={template._id}
            disabled={disabled || !template.isActive}
            onClick={() => onSelectTemplate(template)}
            className="group hover:border-blue-400 flex flex-col justify-between rounded-xl border border-subtle bg-surface-2/60 p-3.5 text-left transition-all hover:bg-surface-1 disabled:opacity-50"
          >
            <div className="space-y-2">
              <TypeIcon type={template.type} boxed size={16} />
              <h3 className="text-xs font-semibold text-primary">{template.name}</h3>
              <p className="line-clamp-2 text-[11px] leading-snug text-secondary">{template.description}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
