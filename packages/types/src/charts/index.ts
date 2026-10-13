/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

// ============================================================
// Chart Base
// ============================================================
export * from "./common";
export type TChartData<K extends string, T extends string> = {
  // required key
  [key in K]: string | number;
} & Record<T, any>;
