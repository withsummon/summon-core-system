/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

export type TPeekOutsidePressAction = "close" | "ignore" | "delay";

/**
 * Decides what an outside press means for the work-item peek. The drawer primitive detects
 * the press; these are the product rules on top of it:
 * - presses inside a `data-prevent-outside-click` container keep the peek open, unless that
 *   container is excluded or also contains the peek;
 * - presses on the peeked work item's own row keep it open;
 * - `data-delay-outside-click` targets close after their own click handler has run.
 */
export const getPeekOutsidePressAction = (
  target: EventTarget | null,
  panel: HTMLElement | null,
  issueId: string,
  excludePreventionElementIds: string[] = []
): TPeekOutsidePressAction => {
  if (!(target instanceof HTMLElement) || !panel || panel.contains(target)) return "ignore";

  const preventOutsideClickElement = target.closest("[data-prevent-outside-click]");
  if (
    preventOutsideClickElement &&
    !excludePreventionElementIds.includes(preventOutsideClickElement.id) &&
    !preventOutsideClickElement.contains(panel)
  )
    return "ignore";

  if (target.closest(`#issue-${CSS.escape(issueId)}`)) return "ignore";
  if (target.closest("[data-delay-outside-click]")) return "delay";
  return "close";
};
