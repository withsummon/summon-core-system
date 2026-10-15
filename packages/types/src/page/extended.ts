/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

export type TPageExtended = {
  /** Summon records where a page's content comes from here; a page synced from Google Drive keeps the file's link. */
  view_props?: { summon_document?: { kind?: string; url?: string } };
};
