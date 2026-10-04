/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { RefObject } from "react";
import { ArrowDown, ArrowUp, GripVertical } from "lucide-react";
import type { FunctionArgs } from "convex/server";
import type { api } from "@summon/convex/api";
import { CloseIcon, EditIcon, TrashIcon } from "@plane/propel/icons";
import { CustomMenu } from "@plane/ui";
import type { ProjectLabel } from "../create-update-label-inline";
import { LabelName } from "./label-name";

export function LabelItemBlock({
  label,
  isDragging,
  dragHandleRef,
  disabled,
  isLabelGroup,
  onEdit,
  labels,
  onDrop,
  handleLabelDelete,
}: {
  label: ProjectLabel;
  isDragging: boolean;
  dragHandleRef: RefObject<HTMLButtonElement>;
  disabled: boolean;
  isLabelGroup: boolean;
  onEdit: () => void;
  labels: ProjectLabel[];
  onDrop: (args: FunctionArgs<typeof api.tasks.labels.save>) => Promise<void>;
  handleLabelDelete: (label: ProjectLabel) => void;
}) {
  const siblings = labels.filter((row) => row.parentId === label.parentId);
  const index = siblings.indexOf(label);
  const previous = siblings[index - 1];
  const next = siblings[index + 1];
  const destinations = labels.filter(
    (row) => row.parentId === null && row._id !== label._id && row._id !== label.parentId && !row.retiring
  );
  return (
    <div className="flex min-w-0 flex-1 items-center justify-between gap-2">
      <div className="flex min-w-0 items-center">
        {!disabled && (
          <button
            type="button"
            ref={dragHandleRef}
            aria-label={`Drag ${label.name}. Use its actions menu to move with the keyboard.`}
            className={`flex shrink-0 cursor-grab rounded-sm bg-surface-2 p-0.5 text-secondary ${isDragging ? "opacity-100" : "opacity-0 group-hover:opacity-100 focus:opacity-100"}`}
          >
            <GripVertical className="size-3.5" aria-hidden="true" />
          </button>
        )}
        <LabelName
          color={label.color}
          name={label.retiring ? `${label.name} · Removing` : label.name}
          isGroup={isLabelGroup}
        />
      </div>
      {!disabled && (
        <div className="flex shrink-0 items-center gap-2">
          <CustomMenu ellipsis ariaLabel={`Actions for ${label.name}`}>
            <CustomMenu.MenuItem
              disabled={!previous || previous.retiring}
              onClick={() => {
                if (previous)
                  void onDrop({
                    projectId: label.projectId,
                    labelId: label._id,
                    expectedRevision: label.revision,
                    change: {
                      kind: "position",
                      parentId: label.parentId,
                      position: { targetId: previous._id, expectedRevision: previous.revision, placement: "before" },
                    },
                  });
              }}
            >
              <ArrowUp className="size-4" aria-hidden="true" />
              Move up
            </CustomMenu.MenuItem>
            <CustomMenu.MenuItem
              disabled={!next || next.retiring}
              onClick={() => {
                if (next)
                  void onDrop({
                    projectId: label.projectId,
                    labelId: label._id,
                    expectedRevision: label.revision,
                    change: {
                      kind: "position",
                      parentId: label.parentId,
                      position: { targetId: next._id, expectedRevision: next.revision, placement: "after" },
                    },
                  });
              }}
            >
              <ArrowDown className="size-4" aria-hidden="true" />
              Move down
            </CustomMenu.MenuItem>
            {!isLabelGroup && destinations.length > 0 && (
              <CustomMenu.SubMenu trigger="Move to group" contentClassName="max-h-64 max-w-80">
                {destinations.map((target) => (
                  <CustomMenu.MenuItem
                    key={target._id}
                    onClick={() =>
                      void onDrop({
                        projectId: label.projectId,
                        labelId: label._id,
                        expectedRevision: label.revision,
                        change: { kind: "position", parentId: target._id, position: { targetId: null } },
                      })
                    }
                  >
                    <span className="truncate">{target.name}</span>
                  </CustomMenu.MenuItem>
                ))}
              </CustomMenu.SubMenu>
            )}
            {label.parentId !== null && (
              <CustomMenu.MenuItem
                onClick={() =>
                  void onDrop({
                    projectId: label.projectId,
                    labelId: label._id,
                    expectedRevision: label.revision,
                    change: { kind: "position", parentId: null, position: { targetId: null } },
                  })
                }
              >
                <CloseIcon className="size-4" />
                Remove from group
              </CustomMenu.MenuItem>
            )}
            <CustomMenu.MenuItem onClick={onEdit}>
              <EditIcon className="size-4" />
              Edit label
            </CustomMenu.MenuItem>
            {isLabelGroup && (
              <CustomMenu.MenuItem onClick={() => handleLabelDelete(label)}>
                <TrashIcon className="size-4" />
                Delete label
              </CustomMenu.MenuItem>
            )}
          </CustomMenu>
          {!isLabelGroup && (
            <button
              type="button"
              aria-label={`Delete ${label.name}`}
              className="flex size-5 items-center justify-center rounded-sm hover:bg-layer-1"
              onClick={() => handleLabelDelete(label)}
            >
              <CloseIcon className="size-3.5 text-tertiary" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
