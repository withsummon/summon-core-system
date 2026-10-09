/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { ComponentProps } from "react";
import { EIconSize, STATE_GROUPS, STATE_TRACKER_ELEMENTS } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
import { PlusIcon, StateGroupIcon, ChevronDownIcon } from "@plane/propel/icons";
import { cn } from "@plane/utils";
import { stateGroups } from "@/components/convex-core/tasks/options";
import { StateList } from "./state-list";
import { StateForm } from "./create-update/form";

type Props = ComponentProps<typeof StateList> &
  Omit<ComponentProps<typeof StateForm>, "data"> & {
    expanded: boolean;
    onToggle: () => void;
    onCreate: (status: ComponentProps<typeof StateList>["status"], color: string) => void;
  };
export function GroupItem(props: Props) {
  const { status, states, disabled, editor, expanded, onToggle, onCreate } = props;
  const { t } = useTranslation();
  const group = STATE_GROUPS[stateGroups[status]];
  const groupStates = states.filter((state) => state.status === status);
  const editing = editor?.data.status === status;
  return (
    <div className="space-y-1 rounded-sm border border-subtle bg-surface-2 p-2">
      <div className="flex items-center justify-between gap-2">
        <button type="button" className="flex w-full items-center py-1" aria-expanded={expanded} onClick={onToggle}>
          <ChevronDownIcon className={cn("size-4 shrink-0 transition-transform", !expanded && "-rotate-90")} />
          <StateGroupIcon stateGroup={group.key} size={EIconSize.XL} />
          <span className="px-1 text-14 font-medium text-secondary capitalize">{group.key}</span>
        </button>
        <button
          type="button"
          aria-label={`Add ${group.label} state`}
          data-ph-element={STATE_TRACKER_ELEMENTS.STATE_GROUP_ADD_BUTTON}
          className="flex size-6 shrink-0 items-center justify-center rounded-sm text-accent-primary hover:bg-layer-1 disabled:text-placeholder"
          disabled={disabled || editor !== null}
          onClick={() => {
            if (!expanded) onToggle();
            onCreate(status, group.color);
          }}
        >
          <PlusIcon className="size-4" />
        </button>
      </div>
      <div hidden={!expanded}>
        {groupStates.length === 0 && !editing && (
          <div className="flex flex-col items-center py-4 text-13 text-tertiary">
            <div>{t("project_settings.states.empty_state.title", { groupKey: group.key })}</div>
            {!disabled && <div>{t("project_settings.states.empty_state.description")}</div>}
          </div>
        )}
        <StateList {...props} />
      </div>
      {editing && <StateForm {...props} data={editor.data} />}
    </div>
  );
}
