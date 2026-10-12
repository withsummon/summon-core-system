/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

/**
 * The one label source for Summon status values: state groups, opportunity stages,
 * project health and delivery status. `not_assessed` → "Not assessed", `in-progress` → "In progress".
 */
export function statusLabel(status: string) {
  const words = status.replaceAll(/[_-]+/g, " ").trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}
