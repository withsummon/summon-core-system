"use client";

import { curveMonotoneX } from "@visx/curve";
import { AreaClosed, LinePath } from "@visx/shape";

// CurveFactory type - simplified version compatible with visx
// biome-ignore lint/suspicious/noExplicitAny: d3 curve factory type
type CurveFactory = any;

import { useCallback, useId, useMemo, useRef } from "react";
import { AreaGradientDefs } from "./area-gradient-defs";
import { useChartStable, useYScale } from "./chart-context";
import { chartCssVars } from "./chart-theme";
import { type LoadingStyle, isSeriesVisiblePhase } from "./chart-phase";
import { type FadeEdges, resolveFadeSides } from "./fade-edges";
import type { LineLoadingPulseMode } from "./line-loading-pulse";
import { resolveDashTailBounds, usePathStrokeMetrics } from "./path-stroke-utils";
import { SeriesDashTailOverlay } from "./series-dash-tail-overlay";
import { SeriesHighlightLayer } from "./series-highlight-layer";
import { SeriesHoverDim } from "./series-hover-dim";
import { SeriesLoadingOverlays, useSeriesLoadingPulse } from "./series-loading";
import { SeriesMarkers } from "./series-markers";
import { resolveMarkerPaint } from "./series-marker-geometry";
import type { SeriesPointMarkerStyle } from "./series-point-marker";

export interface AreaProps {
  /** Key in data to use for y values */
  dataKey: string;
  /** Y-scale group id (Recharts `yAxisId`). Default: `"left"`. */
  yAxisId?: string | number;
  /** Fill color for the area gradient start. Default: var(--chart-line-primary) */
  fill?: string;
  /** Fill opacity at the top of the area. Default: 0.4 */
  fillOpacity?: number;
  /** Stroke color for the line. Default: same as fill */
  stroke?: string;
  /** Stroke width. Default: 2 */
  strokeWidth?: number;
  /** Curve function. Default: curveMonotoneX */
  curve?: CurveFactory;
  /** Whether to animate the area. Default: true */
  animate?: boolean;
  /** Whether to show the stroke line. Default: true */
  showLine?: boolean;
  /** Whether to show highlight segment on hover. Default: true */
  showHighlight?: boolean;
  /** Gradient opacity at bottom (0 = fully transparent). Default: 0 */
  gradientToOpacity?: number;
  /**
   * Vertical extent of the fill gradient (0–1). `1` fades across the full
   * height; lower values compress the gradient toward the top.
   */
  gradientSpan?: number;
  /**
   * Fade the area fill (and stroke) toward transparent at the chart edges.
   * - `true` fades both edges, `false` disables the fade entirely.
   * - `"left"` / `"right"` fades only that side — useful when the opposite
   *   edge butts up against another element you don't want to fade into.
   * Default: false
   */
  fadeEdges?: FadeEdges;
  /** Render scatter-style circle markers at each data point. Default: false */
  showMarkers?: boolean;
  /** Marker styling (same options as Scatter). */
  markers?: SeriesPointMarkerStyle;
  /**
   * Data index from which the line stroke becomes dashed (inclusive).
   * Useful for projecting incomplete periods, e.g. dashed from yesterday through today.
   */
  dashFromIndex?: number;
  /** Dash pattern for the tail segment when `dashFromIndex` is set. Default: "6,4" */
  dashArray?: string;
  /** Pulse stroke color while chart is loading. Default: var(--txt-primary) */
  loadingStroke?: string;
  /** Pulse stroke opacity while chart is loading. Default: 0.5 */
  loadingStrokeOpacity?: number;
  /**
   * Show the loading pulse overlay. Default: follows chart loading phase.
   * Set `false` to disable even during loading.
   */
  loading?: boolean;
  /** Override pulse animation mode (loop / exit / enter). */
  loadingPulseMode?: LineLoadingPulseMode;
  /**
   * Loading animation while the chart is in loading status: the default
   * traveling `"pulse"`, or a diagonal `"sweep"` shimmer across the skeleton
   * area. Default: `"pulse"`.
   */
  loadingStyle?: LoadingStyle;
}

export function Area({
  dataKey,
  yAxisId,
  fill = chartCssVars.linePrimary,
  fillOpacity = 0.4,
  stroke,
  strokeWidth = 2,
  curve = curveMonotoneX,
  animate = true,
  showLine = true,
  showHighlight = true,
  gradientToOpacity = 0,
  gradientSpan = 1,
  fadeEdges = false,
  showMarkers = false,
  markers,
  dashFromIndex,
  dashArray = "6,4",
  loading,
  loadingStroke = chartCssVars.foreground,
  loadingStrokeOpacity = 0.5,
  loadingPulseMode,
  loadingStyle = "pulse",
}: AreaProps) {
  // Stable slice only: hover state lives inside `<SeriesHoverDim>` and
  // `<SeriesHighlightLayer>` so this component (and its expensive
  // <SeriesDashTailOverlay> child) does not re-render on cursor motion.
  // The reveal-clip is now a single shared clipPath at the chart-shell
  // level (`time-series-chart-shell.tsx`); we no longer render a per-area
  // `<ChartRevealClip>` or read `revealEpoch` here.
  const {
    data,
    renderData,
    xScale,
    innerHeight,
    innerWidth,
    xAccessor,
    lines,
    chartPhase,
    notifyLoadingPulseComplete,
  } = useChartStable();
  const yScale = useYScale(yAxisId);
  const showSeriesContent = isSeriesVisiblePhase(chartPhase);
  const pulse = useSeriesLoadingPulse({ chartPhase, loading, loadingPulseMode, notifyLoadingPulseComplete });
  const { showLoadingPulse } = pulse;

  const seriesIndex = useMemo(() => {
    const index = lines.findIndex((line) => line.dataKey === dataKey);
    return index >= 0 ? index : 0;
  }, [lines, dataKey]);

  const pathRef = useRef<SVGPathElement>(null);
  const { pathLength, pathD } = usePathStrokeMetrics(pathRef, [
    renderData,
    innerWidth,
    dashFromIndex,
    showLine,
    showSeriesContent,
    showLoadingPulse,
  ]);

  // Unique IDs for this area
  const uniqueId = useId();
  const gradientId = `area-gradient-${dataKey}-${uniqueId}`;
  const strokeGradientId = `area-stroke-gradient-${dataKey}-${uniqueId}`;
  const edgeMaskId = `area-edge-mask-${dataKey}-${uniqueId}`;
  const edgeGradientId = `${edgeMaskId}-gradient`;

  const { isPatternFill, areaFill, resolvedStroke, strokePaint, useViewportEdgeFade } = resolveAreaPaint({
    fill,
    stroke,
    fadeEdges,
    gradientId,
    strokeGradientId,
  });
  const showAreaFill = showSeriesContent && (isPatternFill || fillOpacity > 0);

  const getY = useCallback(
    (d: Record<string, unknown>) => {
      const value = d[dataKey];
      return typeof value === "number" ? (yScale(value) ?? 0) : 0;
    },
    [dataKey, yScale]
  );

  const highlightEnabled = showHighlight && showLine && !showLoadingPulse && showSeriesContent;

  const seriesLayers = (
    <>
      {showAreaFill ? (
        <AreaClosed
          curve={curve}
          data={renderData}
          fill={areaFill}
          x={(d) => xScale(xAccessor(d)) ?? 0}
          y={getY}
          yScale={yScale}
        />
      ) : null}

      {showLine && (showSeriesContent || showLoadingPulse) ? (
        <AreaStroke
          curve={curve}
          dashArray={dashArray}
          dashFromIndex={dashFromIndex}
          getY={getY}
          pathD={pathD}
          pathLength={pathLength}
          pathRef={pathRef}
          showSeriesStroke={showSeriesContent}
          stroke={strokePaint}
          strokeWidth={strokeWidth}
        />
      ) : null}
    </>
  );

  return (
    <>
      <AreaGradientDefs
        edgeGradientId={edgeGradientId}
        edgeMaskId={edgeMaskId}
        fadeEdges={fadeEdges}
        fill={fill}
        fillOpacity={fillOpacity}
        gradientId={gradientId}
        gradientSpan={gradientSpan}
        gradientToOpacity={gradientToOpacity}
        innerHeight={innerHeight}
        innerWidth={innerWidth}
        isPatternFill={isPatternFill}
        resolvedStroke={resolvedStroke}
        strokeGradientId={strokeGradientId}
      />

      <SeriesHoverDim dimOpacity={0.6} enabled={showHighlight} seriesIndex={seriesIndex}>
        {useViewportEdgeFade ? <g mask={`url(#${edgeMaskId})`}>{seriesLayers}</g> : seriesLayers}
      </SeriesHoverDim>

      {/* Highlight segment on hover — isolated hover subscriber. */}
      <SeriesHighlightLayer
        enabled={highlightEnabled}
        height={innerHeight}
        pathRef={pathRef}
        stroke={resolvedStroke}
        strokeWidth={strokeWidth}
      />

      {showMarkers && showSeriesContent ? (
        <SeriesMarkers
          animate={animate}
          dataKey={dataKey}
          {...markers}
          {...resolveMarkerPaint(markers, resolvedStroke)}
        />
      ) : null}

      <SeriesLoadingOverlays
        curve={curve}
        innerWidth={innerWidth}
        loadingStroke={loadingStroke}
        loadingStrokeOpacity={loadingStrokeOpacity}
        loadingStyle={loadingStyle}
        pathD={pathD}
        pulse={pulse}
        strokeWidth={strokeWidth}
        withArea
      />
    </>
  );
}

/**
 * The series line. While loading it stays transparent but mounted, so the loading pulse can measure
 * its path; a dashed tail draws the stroke itself, so the base line hides then too.
 */
function AreaStroke({
  curve,
  getY,
  pathRef,
  pathD,
  pathLength,
  showSeriesStroke,
  stroke,
  strokeWidth,
  dashArray,
  dashFromIndex,
}: {
  curve: CurveFactory;
  getY: (d: Record<string, unknown>) => number;
  pathRef: React.RefObject<SVGPathElement>;
  pathD: string | null;
  pathLength: number;
  showSeriesStroke: boolean;
  stroke: string;
  strokeWidth: number;
  dashArray: string;
  dashFromIndex?: number;
}) {
  const { data, renderData, xScale, xAccessor, innerHeight, innerWidth } = useChartStable();
  const hasDashTail = resolveDashTailBounds(dashFromIndex, data.length);
  return (
    <>
      <LinePath
        curve={curve}
        data={renderData}
        innerRef={pathRef}
        stroke={showSeriesStroke && !hasDashTail ? stroke : "transparent"}
        strokeLinecap="round"
        strokeWidth={strokeWidth}
        x={(d) => xScale(xAccessor(d)) ?? 0}
        y={getY}
      />
      {showSeriesStroke ? (
        <SeriesDashTailOverlay
          dashArray={dashArray}
          dashFromIndex={dashFromIndex}
          data={data}
          innerHeight={innerHeight}
          innerWidth={innerWidth}
          pathD={pathD}
          pathLength={pathLength}
          stroke={stroke}
          strokeWidth={strokeWidth}
          xAccessor={xAccessor}
          xScale={xScale}
        />
      ) : null}
    </>
  );
}

/**
 * Paint for the fill and stroke. Pattern fills (`url(...)`) need a real stroke color; edge fades
 * use the viewport mask for solid fills and a stroke gradient for pattern fills.
 */
function resolveAreaPaint({
  fill,
  stroke,
  fadeEdges,
  gradientId,
  strokeGradientId,
}: {
  fill: string;
  stroke?: string;
  fadeEdges: FadeEdges;
  gradientId: string;
  strokeGradientId: string;
}) {
  const isPatternFill = fill.startsWith("url(");
  const resolvedStroke = stroke || (isPatternFill ? chartCssVars.linePrimary : fill);
  const fadeSides = resolveFadeSides(fadeEdges);
  const useViewportEdgeFade = fadeSides.any && !isPatternFill;
  // The stroke gradient only exists when an edge fades, so a solid stroke avoids an invalid url(#...).
  const strokePaint = fadeSides.any && !useViewportEdgeFade ? `url(#${strokeGradientId})` : resolvedStroke;
  return {
    isPatternFill,
    areaFill: isPatternFill ? fill : `url(#${gradientId})`,
    resolvedStroke,
    strokePaint,
    useViewportEdgeFade,
  };
}

Area.displayName = "Area";

export default Area;
