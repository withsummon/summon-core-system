/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { extractInstruction } from "@atlaskit/pragmatic-drag-and-drop-hitbox/tree-item";
import type { IPragmaticPayloadLocation, InstructionType, TDropTarget } from "@plane/types";
import type { ProjectLabel } from "./create-update-label-inline";

export function getInstructionFromPayload(
  dropTarget: TDropTarget,
  source: TDropTarget,
  location: IPragmaticPayloadLocation
): InstructionType | undefined {
  if (location.current.dropTargets.length > 1 && dropTarget.data.isGroup === true) return "make-child";
  let instruction = extractInstruction(dropTarget.data)?.type;
  if (instruction === "instruction-blocked")
    instruction = dropTarget.data.isChild === true ? "reorder-above" : "make-child";
  if (instruction === "make-child" && source.data.isGroup === true) instruction = "reorder-above";
  return instruction;
}
export function getCanDrop(source: TDropTarget, label: ProjectLabel, isCurrentChild: boolean) {
  return (
    source.data.id !== label._id &&
    source.data.id !== label.parentId &&
    !(isCurrentChild && source.data.isGroup === true)
  );
}

// Render each local row once, including retained foreign-parent and cyclic groups.
export function getLabelRoots(labels: ProjectLabel[]) {
  const ids = new Set(labels.map((row) => row._id));
  const seen = new Set<ProjectLabel["_id"]>();
  const roots: ProjectLabel[] = [];
  const children = new Map<ProjectLabel["_id"], ProjectLabel[]>();
  for (const row of labels) {
    if (row.parentId === null) continue;
    const group = children.get(row.parentId) ?? [];
    group.push(row);
    children.set(row.parentId, group);
  }
  const natural = labels.filter((row) => row.parentId === null || !ids.has(row.parentId));
  for (const root of [...natural, ...labels]) {
    if (seen.has(root._id)) continue;
    roots.push(root);
    const pending = [root];
    while (pending.length) {
      const row = pending.pop();
      if (!row || seen.has(row._id)) continue;
      seen.add(row._id);
      pending.push(...(children.get(row._id) ?? []));
    }
  }
  return roots;
}
