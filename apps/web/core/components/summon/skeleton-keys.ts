/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

/**
 * Keys for `count` placeholder rows. Placeholders never reorder, but a fixed key per slot keeps that explicit
 * instead of keying by array index.
 */
export function skeletonKeys(count: number) {
  return Array.from({ length: count }, (_, slot) => `skeleton-${slot}`);
}
