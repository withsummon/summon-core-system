/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { ComponentProps } from "react";
import { GripVertical, ArrowUp, ArrowDown } from "lucide-react";
import type { FunctionArgs } from "convex/server";
import type { api } from "@summon/convex/api";
import { EIconSize, STATE_TRACKER_ELEMENTS } from "@plane/constants";
import { EditIcon, StateGroupIcon, CloseIcon } from "@plane/propel/icons";
import { STATE_GROUPS } from "@plane/constants";
import { statusOptions, stateGroups } from "@/components/convex-core/tasks/options";
import type { ProjectState } from "./root";
import { StateMarksAsDefault } from "./options/mark-as-default";

type Props = Pick<ComponentProps<typeof StateGroupIcon>, "percentage"> & {
  state: ProjectState;
  stateCount: number;
  disabled: boolean;
  onEdit: (state: ProjectState) => void;
  onDelete: (state: ProjectState) => void;
  onDefault: (stateId: ProjectState["_id"]) => Promise<boolean>;
  onReorder: (
    args: Omit<FunctionArgs<typeof api.tasks.states.reorder>, "projectId" | "expectedRevision">
  ) => Promise<boolean>;
  onMoveUp?: () => Promise<boolean>;
  onMoveDown?: () => Promise<boolean>;
};
const controlClass =
  "flex size-5 shrink-0 items-center justify-center rounded-sm text-secondary hover:bg-layer-1 hover:text-primary disabled:text-placeholder";
export function StateItemTitle({
  state,
  stateCount,
  percentage,
  disabled,
  onEdit,
  onDelete,
  onDefault,
  onReorder,
  onMoveUp,
  onMoveDown,
}: Props) {
  return (
    <div className="flex w-full flex-wrap items-center justify-between gap-2">
      <div className="flex min-w-0 items-center gap-1 px-1">
        {!disabled && stateCount > 1 && <GripVertical className="size-3 shrink-0 text-secondary" aria-hidden="true" />}
        <StateGroupIcon
          stateGroup={stateGroups[state.status]}
          color={state.color}
          size={EIconSize.XL}
          percentage={percentage}
        />
        <div className="min-w-0 px-2 text-13">
          <h6 className="text-13 font-medium break-words">{state.name}</h6>
          <p className="text-11 break-words text-secondary">{state.description}</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 opacity-100 sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100">
        <StateMarksAsDefault state={state} disabled={disabled} onDefault={onDefault} />
        <select
          aria-label={`Move ${state.name} to group`}
          value={state.status}
          disabled={disabled || stateCount === 1}
          className="max-w-24 bg-transparent text-11 text-secondary"
          onChange={(event) => {
            const option = statusOptions.find((row) => row.value === event.target.value);
            if (option) void onReorder({ stateId: state._id, status: option.value, beforeStateId: null });
          }}
        >
          {statusOptions.map((row) => (
            <option key={row.value} value={row.value}>
              {STATE_GROUPS[stateGroups[row.value]].label}
            </option>
          ))}
        </select>
        <button
          type="button"
          aria-label={`Move ${state.name} up`}
          className={controlClass}
          disabled={disabled || !onMoveUp}
          onClick={() => void onMoveUp?.()}
        >
          <ArrowUp className="size-3" />
        </button>
        <button
          type="button"
          aria-label={`Move ${state.name} down`}
          className={controlClass}
          disabled={disabled || !onMoveDown}
          onClick={() => void onMoveDown?.()}
        >
          <ArrowDown className="size-3" />
        </button>
        <button
          type="button"
          aria-label={`Edit ${state.name}`}
          className={controlClass}
          disabled={disabled}
          onClick={() => onEdit(state)}
          data-ph-element={STATE_TRACKER_ELEMENTS.STATE_LIST_EDIT_BUTTON}
        >
          <EditIcon className="size-3" />
        </button>
        <button
          type="button"
          aria-label={`Delete ${state.name}`}
          className={controlClass}
          disabled={disabled || state.isDefault || stateCount === 1}
          title={
            state.isDefault
              ? "Cannot delete the default state."
              : stateCount === 1
                ? "Cannot have an empty group."
                : undefined
          }
          onClick={() => onDelete(state)}
        >
          <CloseIcon className="size-3" />
        </button>
      </div>
    </div>
  );
}
