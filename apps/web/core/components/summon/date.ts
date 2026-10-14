/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { isInDateFormat, renderFormattedDate } from "@plane/utils";

/**
 * The one Summon date formatter. Date-only values (`YYYY-MM-DD`) keep their calendar day; timestamps
 * are read as a Date so the day resolves in the viewer's timezone (renderFormattedDate reads strings as date-only).
 */
export const formatSummonDate = (value: string | null | undefined, fallback = "Not set", formatToken?: string) =>
  (value ? renderFormattedDate(isInDateFormat(value) ? value : new Date(value), formatToken) : undefined) ?? fallback;
