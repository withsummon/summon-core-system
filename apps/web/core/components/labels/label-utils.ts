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
