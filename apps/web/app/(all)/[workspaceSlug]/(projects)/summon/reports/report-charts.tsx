/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import type { ReactNode } from "react";
import { Bar, BarChart, BarYAxis, ChartTooltip } from "@plane/propel/charts/bar-chart";
import {
  Legend,
  LegendItem,
  LegendLabel,
  LegendMarker,
  LegendProgress,
  LegendValue,
} from "@plane/propel/charts/legend";
import { PieCenter, PieChart, PieSlice } from "@plane/propel/charts/pie-chart";
import { Ring, RingCenter, RingChart } from "@plane/propel/charts/ring-chart";
import { percentage } from "./report-view-model";

export type TReportChartItem = { label: string; value: number; color: string; maxValue?: number };

/** Chart colors come from the chart tokens in @plane/tailwind-config, never hex values. */
export const REPORT_CHART_COLORS = {
  accent: "var(--chart-1)",
  success: "var(--chart-success)",
  warning: "var(--chart-warning)",
  danger: "var(--chart-danger)",
  neutral: "var(--chart-neutral)",
} as const;

/** Concentric progress rings: each ring is one share of the same total. */
export function ReportProgressRings(props: {
  items: Array<TReportChartItem & { maxValue: number }>;
  centerValue: ReactNode;
  centerLabel: string;
}) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  return (
    <div className="grid items-center gap-5 sm:grid-cols-[auto_minmax(0,20rem)]">
      <div className="mx-auto size-44">
        <RingChart
          data={props.items}
          strokeWidth={11}
          ringGap={5}
          baseInnerRadius={46}
          hoveredIndex={hoveredIndex}
          onHoverChange={setHoveredIndex}
        >
          {props.items.map((item, index) => (
            <Ring key={item.label} index={index} />
          ))}
          <RingCenter>
            {({ isHovered, data }) =>
              isHovered ? (
                <ChartCenter value={`${percentage(data.value, data.maxValue)}%`} label={data.label} />
              ) : (
                <ChartCenter value={props.centerValue} label={props.centerLabel} />
              )
            }
          </RingCenter>
        </RingChart>
      </div>
      <ReportChartLegend items={props.items} hoveredIndex={hoveredIndex} onHoverChange={setHoveredIndex} showProgress />
    </div>
  );
}

/** Donut of parts that add up to a whole, with a linked legend. The center shows the slice total. */
export function ReportDonut(props: { items: TReportChartItem[]; centerLabel: string }) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const total = props.items.reduce((sum, item) => sum + item.value, 0);
  return (
    <div className="grid items-center gap-5 sm:grid-cols-[auto_minmax(0,20rem)]">
      <div className="mx-auto size-44">
        {total > 0 ? (
          <PieChart
            data={props.items}
            innerRadius={58}
            padAngle={0.03}
            cornerRadius={4}
            hoveredIndex={hoveredIndex}
            onHoverChange={setHoveredIndex}
          >
            {props.items.map((item, index) => (
              <PieSlice key={item.label} index={index} hoverEffect="grow" hoverOffset={4} />
            ))}
            <PieCenter defaultLabel={props.centerLabel} />
          </PieChart>
        ) : (
          // Same ring geometry as the donut (outer radius minus hover offset, inner radius 58).
          <div className="size-full p-1">
            <div className="grid size-full place-items-center rounded-full border-[26px] border-(--chart-track)">
              <ChartCenter value={0} label={props.centerLabel} />
            </div>
          </div>
        )}
      </div>
      <ReportChartLegend items={props.items} hoveredIndex={hoveredIndex} onHoverChange={setHoveredIndex} />
    </div>
  );
}

const PIPELINE_COLORS = {
  open: REPORT_CHART_COLORS.accent,
  won: REPORT_CHART_COLORS.success,
  lost: REPORT_CHART_COLORS.danger,
} as const;

/** Fixed px per stage so bar thickness stays the same on narrow overview cards and the full-width tab. */
const PIPELINE_ROW_HEIGHT = 36;
const PIPELINE_MARGIN = { top: 4, right: 12, bottom: 4, left: 84 };

/** Horizontal stage bars. Won and lost keep their status color; every other stage is open work. */
export function PipelineChart(props: {
  items: Array<{ stage: string; label: string; count: number; value: string }>;
  total: number;
}) {
  const rows = props.items.map((item) => {
    const series: keyof typeof PIPELINE_COLORS = item.stage === "won" || item.stage === "lost" ? item.stage : "open";
    return {
      stage: item.label,
      value: item.value,
      count: item.count,
      open: series === "open" ? item.count : 0,
      won: series === "won" ? item.count : 0,
      lost: series === "lost" ? item.count : 0,
      color: PIPELINE_COLORS[series],
      share: percentage(item.count, props.total),
    };
  });
  const rowByStage = new Map(rows.map((row) => [row.stage, row]));
  return (
    <div style={{ height: rows.length * PIPELINE_ROW_HEIGHT + PIPELINE_MARGIN.top + PIPELINE_MARGIN.bottom }}>
      <BarChart
        data={rows}
        xDataKey="stage"
        orientation="horizontal"
        stacked
        barGap={0.5}
        aspectRatio="auto"
        margin={PIPELINE_MARGIN}
        className="h-full"
      >
        {Object.entries(PIPELINE_COLORS).map(([series, color]) => (
          <Bar key={series} dataKey={series} fill={color} lineCap={4} />
        ))}
        <BarYAxis />
        <ChartTooltip
          showCrosshair={false}
          rows={(point) => {
            const row = rowByStage.get(String(point.stage));
            return row
              ? [{ color: row.color, label: `${row.count} opportunities`, value: `${row.value} · ${row.share}%` }]
              : [];
          }}
        />
      </BarChart>
    </div>
  );
}

function ReportChartLegend(props: {
  items: TReportChartItem[];
  hoveredIndex: number | null;
  onHoverChange: (index: number | null) => void;
  showProgress?: boolean;
}) {
  return (
    <Legend
      items={props.items}
      hoveredIndex={props.hoveredIndex}
      onHoverChange={props.onHoverChange}
      className="min-w-0 gap-0.5"
    >
      <LegendItem className="grid gap-1.5">
        <div className="flex items-center gap-2">
          <LegendMarker className="size-2 rounded-full" />
          <LegendLabel className="min-w-0 flex-1 truncate text-12 font-medium" />
          <LegendValue className="text-12 font-semibold text-primary tabular-nums" />
        </div>
        {props.showProgress ? <LegendProgress height="h-1" /> : null}
      </LegendItem>
    </Legend>
  );
}

function ChartCenter(props: { value: ReactNode; label: string }) {
  return (
    <div className="grid place-items-center text-center">
      <span className="text-2xl font-semibold tracking-tight text-primary tabular-nums">{props.value}</span>
      <span className="mt-0.5 text-12 text-tertiary">{props.label}</span>
    </div>
  );
}
