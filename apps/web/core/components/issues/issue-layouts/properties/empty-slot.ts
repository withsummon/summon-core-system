/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

// Unset properties stay quiet until the row is hovered or focused, fading in place so list columns line up;
// touch devices keep them visible. Board cards show only set properties, as Linear does: clicking a card opens
// the work item, where unset ones are edited.
const EMPTY_LIST_SLOT_CLASSNAME =
  "transition-opacity pointer-fine:opacity-0 pointer-fine:group-hover/list-block:opacity-100 pointer-fine:focus-within:opacity-100 pointer-fine:has-[[aria-expanded=true]]:opacity-100";
export const emptySlotClassName = (layout: string) => (layout === "Kanban" ? "hidden" : EMPTY_LIST_SLOT_CLASSNAME);
