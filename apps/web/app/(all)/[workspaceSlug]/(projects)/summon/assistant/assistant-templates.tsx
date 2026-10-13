/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { CalendarCheck, FileStack, FolderKanban, Send } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { MenuPrimitive as Menu } from "@plane/propel/menu";
import { ASSISTANT_TEMPLATES } from "./assistant-model";
import type { TAssistantTemplate } from "./assistant-model";
import { OptionPopup, isSearchable } from "@/components/summon/option-menu";
import type { TOption } from "@/components/summon/option-menu";
import type { TScopeOptions } from "./assistant-composer";

const TEMPLATE_ICONS: Record<string, LucideIcon> = {
  "project-digest": FolderKanban,
  "client-update": Send,
  "meeting-decisions": CalendarCheck,
  "generate-document": FileStack,
};

const SCOPE_NOUNS: Record<TAssistantTemplate["scope"], string> = {
  project: "project",
  client: "client",
  meeting: "meeting",
};

/** Summon jobs under the composer. Each card asks for the one record it needs, then fills the prompt. */
export function AssistantTemplates(props: {
  options: TScopeOptions;
  onPick: (template: TAssistantTemplate, option: TOption) => void;
}) {
  return (
    <ul className="grid w-full gap-2 sm:grid-cols-2" aria-label="Start from a Summon job">
      {ASSISTANT_TEMPLATES.map((template) => {
        const options = props.options[template.scope];
        const menu = (
          <Menu.Root>
            <Menu.Trigger
              disabled={!options.length}
              className="group flex h-full w-full items-start gap-3 rounded-xl border border-subtle bg-surface-1 p-3 text-left shadow-xs transition-colors hover:bg-layer-1 focus-visible:outline-2 focus-visible:outline-accent-strong disabled:cursor-not-allowed disabled:opacity-60 data-[popup-open]:bg-layer-1"
            >
              <TemplateIcon id={template.id} />
              <span className="min-w-0">
                <span className="block text-13 font-medium text-primary">{template.label}</span>
                <span className="mt-0.5 block text-12 text-secondary">
                  {options.length ? template.description : `No ${SCOPE_NOUNS[template.scope]}s you can access yet`}
                </span>
              </span>
            </Menu.Trigger>
            <Menu.Portal>
              <Menu.Positioner side="bottom" align="start" sideOffset={4} className="z-[120]">
                <OptionPopup
                  label={`Choose a ${SCOPE_NOUNS[template.scope]}`}
                  options={options}
                  isChecked={() => false}
                  onPick={(id) => {
                    const option = options.find((item) => item.id === id);
                    if (option) props.onPick(template, option);
                  }}
                />
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
        );
        return (
          <li key={template.id}>
            {isSearchable(options) ? <Menu.FilterProvider autoHighlight>{menu}</Menu.FilterProvider> : menu}
          </li>
        );
      })}
    </ul>
  );
}

function TemplateIcon({ id }: { id: string }) {
  const Icon = TEMPLATE_ICONS[id] ?? FolderKanban;
  return (
    <span className="grid size-8 flex-none place-items-center rounded-lg bg-layer-2 text-secondary group-hover:text-primary">
      <Icon aria-hidden className="size-4" />
    </span>
  );
}
