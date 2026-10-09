/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

// ----------------------------- EXACT Operator -----------------------------
export type TExtendedExactOperatorConfigs = never;

// ----------------------------- IN Operator -----------------------------
export type TExtendedInOperatorConfigs = never;

// ----------------------------- RANGE Operator -----------------------------
export type TExtendedRangeOperatorConfigs = never;

// ----------------------------- Extended Operator Specific Configs -----------------------------
import type { TFilterValue } from "../expression";
import type { TDateFilterFieldConfig } from "../field-types";
import type { EXTENDED_COMPARISON_OPERATOR } from "../operators";

export type TExtendedOperatorSpecificConfigs = {
  [EXTENDED_COMPARISON_OPERATOR.GTE]: TDateFilterFieldConfig<TFilterValue>;
  [EXTENDED_COMPARISON_OPERATOR.LTE]: TDateFilterFieldConfig<TFilterValue>;
};
