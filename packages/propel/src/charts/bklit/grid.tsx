"use client";

import { GridColumns, GridRows } from "@visx/grid";
import { m } from "framer-motion";
import { useId } from "react";
import { useChartStable, useYScale } from "./chart-context";
import { chartCssVars } from "./chart-theme";
import { useGridShimmer } from "./use-grid-shimmer";
import { isLoadingChromePhase, isLoadingGridChromePhase } from "./y-domain-utils";

const DEFAULT_SHIMMER_LENGTH_PX = 140;
const DEFAULT_SHIMMER_SPEED = 1;
const DEFAULT_SHIMMER_STROKE = "color-mix(in oklch, var(--txt-primary) 68%, transparent)";

export interface GridProps {
  /** Show horizontal grid lines. Default: true */
  horizontal?: boolean;
  /** Show vertical grid lines. Default: false */
  vertical?: boolean;
  /** Number of horizontal grid lines. Default: 5 */
  numTicksRows?: number;
  /** Number of vertical grid lines. Default: 10 */
  numTicksColumns?: number;
  /** Explicit tick values for horizontal grid lines. Overrides numTicksRows. */
  rowTickValues?: number[];
  /** Grid line stroke color. Default: var(--chart-grid) */
  stroke?: string;
  /** Grid stroke while loading chrome is active. Falls back to `stroke`. */
  loadingStroke?: string;
  /** Grid line stroke opacity. Default: 1 */
  strokeOpacity?: number;
  /** Grid line stroke width. Default: 1 */
  strokeWidth?: number;
  /** Grid line dash array. Default: "4,4" for dashed lines */
  strokeDasharray?: string;
  /** Horizontal row values rendered with alternate styling (e.g. zero baseline). */
  highlightRowValues?: number[];
  /** Stroke for highlighted rows. Default: var(--chart-foreground-muted) */
  highlightRowStroke?: string;
  /** Stroke opacity for highlighted rows. Default: 1 */
  highlightRowStrokeOpacity?: number;
  /** Stroke width for highlighted rows. Default: 1 */
  highlightRowStrokeWidth?: number;
  /** Dash array for highlighted rows. Default: solid line */
  highlightRowStrokeDasharray?: string;
  /** Enable horizontal fade effect on grid rows (fades at left/right). Default: true */
  fadeHorizontal?: boolean;
  /** Enable vertical fade effect on grid columns (fades at top/bottom). Default: false */
  fadeVertical?: boolean;
  /** Omit the first and last horizontal grid lines. Default: false */
  hideHorizontalEdgeLines?: boolean;
  /** Omit the first and last vertical grid lines. Default: false */
  hideVerticalEdgeLines?: boolean;
  /** Y-scale for horizontal grid lines. Default: primary (`"left"`) axis. */
  yAxisId?: string | number;
  /** Animate a shimmer band across horizontal grid lines. Default: false */
  shimmer?: boolean;
  /** Shimmer band stroke (color and opacity via color-mix or oklch alpha). */
  shimmerStroke?: string;
  /** Shimmer band width in pixels. Default: 140 */
  shimmerLength?: number;
  /** Shimmer speed multiplier (higher = faster). Default: 1 */
  shimmerSpeed?: number;
  /** Match loop timing to the loading line pulse (cycle + inter-loop pause). */
  shimmerSync?: boolean;
}

function hideEdgeTicks<T>(ticks: T[], hideEdgeLines: boolean): T[] {
  if (!hideEdgeLines || ticks.length <= 2) {
    return ticks;
  }
  return ticks.slice(1, -1);
}

function resolveRowTickValues(options: {
  hideHorizontalEdgeLines: boolean;
  numTicksRows: number;
  rowTickValues?: number[];
  yScale: { ticks?: (count: number) => number[] };
}): number[] | undefined {
  const { hideHorizontalEdgeLines, numTicksRows, rowTickValues, yScale } = options;
  const ticks = rowTickValues ?? (yScale.ticks ? yScale.ticks(numTicksRows) : []);
  const filtered = hideEdgeTicks(ticks, hideHorizontalEdgeLines);
  if (filtered === ticks && !rowTickValues && !hideHorizontalEdgeLines) {
    return undefined;
  }
  return filtered.length > 0 ? filtered : undefined;
}

export function Grid({
  horizontal = true,
  vertical = false,
  numTicksRows = 5,
  numTicksColumns = 10,
  rowTickValues,
  stroke = chartCssVars.grid,
  loadingStroke,
  strokeOpacity = 1,
  strokeWidth = 1,
  strokeDasharray = "4,4",
  highlightRowValues,
  highlightRowStroke = chartCssVars.foregroundMuted,
  highlightRowStrokeOpacity = 1,
  highlightRowStrokeWidth = 1,
  highlightRowStrokeDasharray = "0",
  fadeHorizontal = true,
  fadeVertical = false,
  hideHorizontalEdgeLines = false,
  hideVerticalEdgeLines = false,
  yAxisId,
  shimmer = false,
  shimmerStroke = DEFAULT_SHIMMER_STROKE,
  shimmerLength = DEFAULT_SHIMMER_LENGTH_PX,
  shimmerSpeed = DEFAULT_SHIMMER_SPEED,
  shimmerSync = false,
}: GridProps) {
  const { xScale, innerWidth, innerHeight, orientation, barScale, chartPhase } = useChartStable();
  const yScale = useYScale(yAxisId);
  const uniqueId = useId();
  // Horizontal bar charts put the value scale on x, so their columns follow yScale.
  const columnScale = orientation === "horizontal" && barScale ? yScale : xScale;
  const lineStyle = { stroke, strokeDasharray, strokeOpacity, strokeWidth };

  return (
    <g className="chart-grid">
      {horizontal ? (
        <GridRowsLayer
          {...lineStyle}
          fade={fadeHorizontal}
          height={innerHeight}
          highlight={{
            values: highlightRowValues,
            stroke: highlightRowStroke,
            strokeOpacity: highlightRowStrokeOpacity,
            strokeWidth: highlightRowStrokeWidth,
            dasharray: highlightRowStrokeDasharray,
          }}
          idPrefix={uniqueId}
          shimmer={{
            enabled: shimmer,
            active: shimmer && isLoadingChromePhase(chartPhase),
            stroke: shimmerStroke,
            length: shimmerLength,
            speed: shimmerSpeed,
            sync: shimmerSync,
          }}
          stroke={isLoadingGridChromePhase(chartPhase) && loadingStroke != null ? loadingStroke : stroke}
          tickValues={resolveRowTickValues({ hideHorizontalEdgeLines, numTicksRows, rowTickValues, yScale })}
          numTicks={numTicksRows}
          width={innerWidth}
          yScale={yScale}
        />
      ) : null}
      {vertical && typeof columnScale === "function" ? (
        <GridColumnsLayer
          {...lineStyle}
          fade={fadeVertical}
          height={innerHeight}
          idPrefix={uniqueId}
          numTicks={numTicksColumns}
          scale={columnScale}
          tickValues={hideVerticalEdgeLines ? resolveColumnTickValues(columnScale, numTicksColumns) : undefined}
          width={innerWidth}
        />
      ) : null}
    </g>
  );
}

interface GridLineStyle {
  stroke: string;
  strokeDasharray: string;
  strokeOpacity: number;
  strokeWidth: number;
}

/** Row lines with their left/right fade, the loading shimmer, and highlighted values. */
function GridRowsLayer({
  fade,
  idPrefix,
  width,
  height,
  yScale,
  numTicks,
  tickValues,
  shimmer,
  highlight,
  ...line
}: GridLineStyle & {
  fade: boolean;
  idPrefix: string;
  width: number;
  height: number;
  yScale: ReturnType<typeof useYScale>;
  numTicks: number;
  tickValues: number[] | undefined;
  shimmer: { enabled: boolean; active: boolean; stroke: string; length: number; speed: number; sync: boolean };
  highlight: { values?: number[]; stroke: string; strokeOpacity: number; strokeWidth: number; dasharray: string };
}) {
  const { shimmerEnabled, shimmerTransform } = useGridShimmer({
    innerWidth: width,
    shimmer: shimmer.enabled,
    shimmerLength: shimmer.length,
    shimmerSpeed: shimmer.speed,
    shimmerSync: shimmer.sync,
    active: shimmer.active,
  });
  const maskId = `grid-rows-fade-${idPrefix}`;
  const shimmerGradientId = `grid-shimmer-${idPrefix}`;
  const rows = { numTicks: tickValues ? undefined : numTicks, scale: yScale, tickValues, width };

  return (
    <>
      {fade ? <GridFadeMask direction="horizontal" height={height} maskId={maskId} width={width} /> : null}
      {shimmerEnabled ? (
        <GridShimmerGradient
          gradientId={shimmerGradientId}
          length={shimmer.length}
          stroke={shimmer.stroke}
          transform={shimmerTransform}
        />
      ) : null}
      <g mask={fade ? `url(#${maskId})` : undefined}>
        <GridRows {...rows} {...line} />
        {shimmerEnabled ? (
          <GridRows {...rows} {...line} stroke={`url(#${shimmerGradientId})`} strokeOpacity={1} />
        ) : null}
      </g>
      {highlight.values?.length ? (
        <GridHighlightRows
          dasharray={highlight.dasharray}
          stroke={highlight.stroke}
          strokeOpacity={highlight.strokeOpacity}
          strokeWidth={highlight.strokeWidth}
          values={highlight.values}
          width={width}
          yScale={yScale}
        />
      ) : null}
    </>
  );
}

/** Column lines with their top/bottom fade. */
function GridColumnsLayer({
  fade,
  idPrefix,
  width,
  height,
  scale,
  numTicks,
  tickValues,
  ...line
}: GridLineStyle & {
  fade: boolean;
  idPrefix: string;
  width: number;
  height: number;
  scale: Parameters<typeof GridColumns>[0]["scale"];
  numTicks: number;
  tickValues: (number | Date)[] | undefined;
}) {
  const maskId = `grid-cols-fade-${idPrefix}`;
  return (
    <>
      {fade ? <GridFadeMask direction="vertical" height={height} maskId={maskId} width={width} /> : null}
      <g mask={fade ? `url(#${maskId})` : undefined}>
        <GridColumns
          {...line}
          height={height}
          numTicks={tickValues ? undefined : numTicks}
          scale={scale}
          tickValues={tickValues}
        />
      </g>
    </>
  );
}

/** Mask that fades grid lines out at both ends: left/right for rows, top/bottom for columns. */
function GridFadeMask({
  direction,
  maskId,
  width,
  height,
}: {
  direction: "horizontal" | "vertical";
  maskId: string;
  width: number;
  height: number;
}) {
  const gradientId = `${maskId}-gradient`;
  const end = direction === "horizontal" ? { x2: "100%", y2: "0%" } : { x2: "0%", y2: "100%" };
  return (
    <defs>
      <linearGradient id={gradientId} x1="0%" y1="0%" {...end}>
        <stop offset="0%" style={{ stopColor: "white", stopOpacity: 0 }} />
        <stop offset="10%" style={{ stopColor: "white", stopOpacity: 1 }} />
        <stop offset="90%" style={{ stopColor: "white", stopOpacity: 1 }} />
        <stop offset="100%" style={{ stopColor: "white", stopOpacity: 0 }} />
      </linearGradient>
      <mask id={maskId}>
        <rect fill={`url(#${gradientId})`} height={height} width={width} x="0" y="0" />
      </mask>
    </defs>
  );
}

/** Bright band that travels along the row lines while the chart loads. */
function GridShimmerGradient({
  gradientId,
  length,
  stroke,
  transform,
}: {
  gradientId: string;
  length: number;
  stroke: string;
  transform: ReturnType<typeof useGridShimmer>["shimmerTransform"];
}) {
  return (
    <defs>
      <m.linearGradient
        gradientTransform={transform}
        gradientUnits="userSpaceOnUse"
        id={gradientId}
        x1={0}
        x2={length}
        y1={0}
        y2={0}
      >
        <stop offset="0%" stopColor={stroke} stopOpacity={0} />
        <stop offset="35%" stopColor={stroke} stopOpacity={0.45} />
        <stop offset="50%" stopColor={stroke} stopOpacity={1} />
        <stop offset="65%" stopColor={stroke} stopOpacity={0.45} />
        <stop offset="100%" stopColor={stroke} stopOpacity={0} />
      </m.linearGradient>
    </defs>
  );
}

function GridHighlightRows({
  values,
  yScale,
  width,
  stroke,
  strokeOpacity,
  strokeWidth,
  dasharray,
}: {
  values: number[];
  yScale: (value: number) => number | undefined;
  width: number;
  stroke: string;
  strokeOpacity: number;
  strokeWidth: number;
  dasharray: string;
}) {
  return (
    <g className="chart-grid-highlight-rows">
      {values.map((value) => {
        const y = yScale(value);
        if (y == null || !Number.isFinite(y)) {
          return null;
        }
        return (
          <line
            key={value}
            stroke={stroke}
            strokeDasharray={dasharray}
            strokeOpacity={strokeOpacity}
            strokeWidth={strokeWidth}
            x1={0}
            x2={width}
            y1={y}
            y2={y}
          />
        );
      })}
    </g>
  );
}

function resolveColumnTickValues(
  columnScale: { ticks?: (count: number) => (number | Date)[] },
  numTicksColumns: number
): (number | Date)[] | undefined {
  const ticks = columnScale.ticks?.(numTicksColumns) ?? [];
  const filtered = hideEdgeTicks<number | Date>(ticks, true);
  return filtered.length > 0 ? filtered : undefined;
}

Grid.displayName = "Grid";

export default Grid;
