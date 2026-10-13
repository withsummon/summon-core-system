/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import React from "react";
// plane imports
import { Area, AreaChart, ChartTooltip, Grid, XAxis, YAxis } from "@plane/propel/charts/area-chart";
import type { TModuleCompletionChartDistribution } from "@plane/types";
// components
import { ChartSeriesLegend } from "@/components/chart/series-legend";

type Props = {
  distribution: TModuleCompletionChartDistribution;
  totalIssues: number;
  className?: string;
  plotTitle?: string;
};

const CURRENT_COLOR = "var(--chart-1)";
const IDEAL_COLOR = "var(--chart-neutral)";

function ProgressChart({ distribution, totalIssues, className = "", plotTitle = "work items" }: Props) {
  const dates = Object.keys(distribution ?? {});
  const chartData = dates.map((key, index) => ({
    date: new Date(key),
    current: distribution[key] ?? 0,
    ideal: totalIssues * (1 - index / Math.max(1, dates.length - 1)),
  }));

  return (
    <div className={`flex w-full flex-col gap-3 ${className}`}>
      <AreaChart data={chartData} aspectRatio="auto" className="h-[340px] w-full" margin={{ left: 44, right: 16 }}>
        <Grid horizontal strokeDasharray="3 4" />
        <Area dataKey="ideal" stroke={IDEAL_COLOR} fill={IDEAL_COLOR} fillOpacity={0} dashFromIndex={0} />
        <Area dataKey="current" stroke={CURRENT_COLOR} fill={CURRENT_COLOR} fillOpacity={0.24} showMarkers />
        <XAxis />
        <YAxis />
        <ChartTooltip
          rows={(point) => [
            { color: CURRENT_COLOR, label: `Current ${plotTitle}`, value: Math.round(Number(point.current)) },
            { color: IDEAL_COLOR, label: `Ideal ${plotTitle}`, value: Math.round(Number(point.ideal)) },
          ]}
        />
      </AreaChart>
      <ChartSeriesLegend
        className="justify-center"
        showValue={false}
        items={[
          { label: `Current ${plotTitle}`, value: 0, color: CURRENT_COLOR },
          { label: `Ideal ${plotTitle}`, value: 0, color: IDEAL_COLOR },
        ]}
      />
    </div>
  );
}

export default ProgressChart;
