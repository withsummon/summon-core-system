/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { ArrowRight } from "lucide-react";
import type { ISummonAutomationTemplate } from "@plane/types";
import { templateLabel, templateVisual } from "./automation-display";

function AutomationTemplateCard(props: {
  item: ISummonAutomationTemplate;
  selected: boolean;
  onOpen: (templateId: string) => void;
}) {
  const { item } = props;
  const { Icon, tone: iconTone } = templateVisual(item.type);
  return (
    <button
      type="button"
      onClick={() => props.onOpen(item.id)}
      className={`group flex items-center gap-3 rounded-xl border bg-surface-1 p-3 text-left transition-colors hover:border-accent-strong sm:p-4 ${
        props.selected ? "border-accent-strong ring-1 ring-accent-subtle" : "border-subtle"
      }`}
    >
      <span className={`grid size-9 shrink-0 place-items-center rounded-xl ${iconTone}`}>
        <Icon className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p title={item.name} className="truncate text-13 font-semibold text-primary">
          {item.name}
        </p>
        <p className="mt-0.5 hidden truncate text-12 text-secondary sm:block">
          {item.description || `Generate ${templateLabel(item.type).toLowerCase()} from verified workspace context.`}
        </p>
      </div>
      <ArrowRight className="size-4 shrink-0 text-tertiary transition-transform group-hover:translate-x-0.5" />
    </button>
  );
}

export function AutomationTemplateGrid(props: {
  templates: ISummonAutomationTemplate[];
  selectedTemplateId: string;
  onOpen: (templateId: string) => void;
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-2 sm:gap-2.5 lg:grid-cols-3 xl:grid-cols-4">
      {props.templates.map((item) => (
        <AutomationTemplateCard
          key={item.id}
          item={item}
          selected={props.selectedTemplateId === item.id}
          onOpen={props.onOpen}
        />
      ))}
    </div>
  );
}
