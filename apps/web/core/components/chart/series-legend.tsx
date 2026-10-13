/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { Legend, LegendItem, LegendLabel, LegendMarker, LegendValue } from "@plane/propel/charts/legend";

type Props = {
  items: Array<{ label: string; value: number; color: string }>;
  showValue?: boolean;
  className?: string;
};

/** Inline series key for axis charts: marker, series name and, optionally, its total. */
export function ChartSeriesLegend({ items, showValue = true, className = "" }: Props) {
  return (
    <Legend items={items} className={`flex-row flex-wrap gap-1 ${className}`}>
      <LegendItem className="flex items-center gap-2">
        <LegendMarker className="size-2 rounded-full" />
        <LegendLabel className="text-12 font-medium" />
        {showValue ? <LegendValue className="text-12 text-tertiary tabular-nums" /> : null}
      </LegendItem>
    </Legend>
  );
}
