/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { TExtendedSupportedOperators } from "@plane/types";
import { EXTENDED_COMPARISON_OPERATOR } from "@plane/types";

/**
 * Extended operator labels
 */
export const EXTENDED_OPERATOR_LABELS_MAP: Record<TExtendedSupportedOperators, string> = {
  [EXTENDED_COMPARISON_OPERATOR.GTE]: "on or after",
  [EXTENDED_COMPARISON_OPERATOR.LTE]: "on or before",
};

/**
 * Extended date-specific operator labels
 */
export const EXTENDED_DATE_OPERATOR_LABELS_MAP = EXTENDED_OPERATOR_LABELS_MAP;

/**
 * Negated operator labels for all operators
 */
export const NEGATED_OPERATOR_LABELS_MAP: Record<never, string> = {} as const;

/**
 * Negated date operator labels for all date operators
 */
export const NEGATED_DATE_OPERATOR_LABELS_MAP: Record<never, string> = {} as const;
