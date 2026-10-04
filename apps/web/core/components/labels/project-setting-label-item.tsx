/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { ReactNode } from "react";
import type { FunctionArgs } from "convex/server";
import { api } from "@summon/convex/api";
import type { Id } from "@summon/convex/data-model";
import type { ProjectLabel } from "./create-update-label-inline";
import { LabelItemBlock } from "./label-block/label-item-block";
import { LabelDndHOC } from "./label-drag-n-drop-HOC";

export function ProjectSettingLabelItem({
  label,
  labels,
  canManage,
  handleLabelDelete,
  isChild,
  isLastChild,
  onDrop,
  onEdit,
  editingLabelId,
  editor,
  children,
}: {
  label: ProjectLabel;
  labels: ProjectLabel[];
  canManage: boolean;
  handleLabelDelete: (label: ProjectLabel) => void;
  isChild: boolean;
  isLastChild: boolean;
  onDrop: (args: FunctionArgs<typeof api.tasks.labels.save>) => Promise<void>;
  onEdit: (label: ProjectLabel) => void;
  editingLabelId?: Id<"taskLabels">;
  editor: ReactNode;
  children?: ReactNode;
}) {
  const editing = editingLabelId === label._id;
  const group = labels.some((row) => row.parentId === label._id);
  return (
    <LabelDndHOC
      label={label}
      labels={labels}
      isGroup={group}
      isChild={isChild}
      isLastChild={isLastChild}
      isEditable={canManage && !label.retiring && !editing}
      onDrop={onDrop}
    >
      {(isDragging, isDropping, dragHandleRef) => (
        <div
          className={`group rounded-sm ${isDropping ? "border-2 border-accent-strong" : "border border-subtle"} ${isDragging ? "bg-layer-1" : "bg-surface-1"}`}
        >
          <div className="flex min-w-0 items-center gap-2 px-1 py-3">
            {editing ? (
              editor
            ) : (
              <LabelItemBlock
                label={label}
                isDragging={isDragging}
                disabled={!canManage || label.retiring}
                isLabelGroup={group}
                dragHandleRef={dragHandleRef}
                onEdit={() => onEdit(label)}
                labels={labels}
                onDrop={onDrop}
                handleLabelDelete={handleLabelDelete}
              />
            )}
            {children}
          </div>
        </div>
      )}
    </LabelDndHOC>
  );
}
