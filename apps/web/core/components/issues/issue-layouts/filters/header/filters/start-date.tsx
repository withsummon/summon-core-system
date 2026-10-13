/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { TDateFilterProps } from "@/components/core/filters/date-filter-section";
import { DateFilterSection } from "@/components/core/filters/date-filter-section";

const isCustomDateFilter = (filter: string) => filter.includes("-");

export function FilterStartDate(props: TDateFilterProps) {
  return <DateFilterSection title="Start date" isCustomDateFilter={isCustomDateFilter} {...props} />;
}
