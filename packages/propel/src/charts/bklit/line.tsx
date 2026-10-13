"use client";

import { curveNatural } from "@visx/curve";
import { LinePath } from "@visx/shape";

// CurveFactory type - simplified version compatible with visx
// biome-ignore lint/suspicious/noExplicitAny: d3 curve factory type
type CurveFactory = any;

import { type RefObject, useCallback, useId, useMemo, useRef } from "react";
import { useChartStable, useYScale } from "./chart-context";
import { chartCssVars } from "./chart-theme";
import { type LoadingStyle, isSeriesVisiblePhase } from "./chart-phase";
import { type FadeEdges, fadeGradientStops, resolveFadeSides, viewportFadeGradientAttrs } from "./fade-edges";
import type { LineLoadingPulseMode } from "./line-loading-pulse";
import { resolveDashTailBounds, usePathStrokeMetrics } from "./path-stroke-utils";
import { SeriesDashTailOverlay } from "./series-dash-tail-overlay";
import { SeriesHighlightLayer } from "./series-highlight-layer";
import { SeriesHoverDim } from "./series-hover-dim";
import { SeriesLoadingOverlays, useSeriesLoadingPulse } from "./series-loading";
import { SeriesMarkers } from "./series-markers";
import { resolveMarkerPaint } from "./series-marker-geometry";
import type { SeriesPointMarkerStyle } from "./series-point-marker";
import { useAnimatedSeriesPath } from "./use-animated-series-path";

export interface LineProps {
  /** Key in data to use for y values */
  dataKey: string;
  /** Y-scale group id (Recharts `yAxisId`). Default: `"left"`. */
  yAxisId?: string | number;
  /** Stroke color. Default: var(--chart-line-primary) */
  stroke?: string;
  /** Stroke width. Default: 2.5 */
  strokeWidth?: number;
  /** Curve function. Default: curveNatural */
  curve?: CurveFactory;
  /** Whether to animate the line. Default: true */
  animate?: boolean;
  /**
   * Fade the line stroke toward transparent at the chart edges.
   * - `true` fades both edges, `false` disables the fade entirely.
   * - `"left"` / `"right"` fades only that side.
   * Default: true
   */
  fadeEdges?: FadeEdges;
  /** Whether to show highlight segment on hover. Default: true */
  showHighlight?: boolean;
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
  /**
   * Show the loading pulse overlay. Default: follows chart loading phase.
   * Set `false` to disable even during loading.
   */
  loading?: boolean;
  /** Stroke color for the loading pulse overlay. Default: var(--txt-primary) */
  loadingStroke?: string;
  /** Loading pulse stroke opacity. Default: 0.5 */
  loadingStrokeOpacity?: number;
  /** Override pulse animation mode (loop / exit / enter). */
  loadingPulseMode?: LineLoadingPulseMode;
  /** Called when a loop-mode pulse cycle completes. */
  onLoadingPulseCycleComplete?: () => void;
  /**
   * Loading animation while the chart is in loading status: the default
   * traveling `"pulse"`, or a diagonal `"sweep"` shimmer across the skeleton
   * line. Default: `"pulse"`.
   */
  loadingStyle?: LoadingStyle;
}

function LineSeriesStroke({
  animatedPathD,
  curve,
  getY,
  pathRef,
  renderData,
  strokeWidth,
  useDataTransitionPath,
  visibleStroke,
  xAccessor,
  xScale,
}: {
  animatedPathD: string;
  curve: CurveFactory;
  getY: (datum: Record<string, unknown>) => number;
  pathRef: RefObject<SVGPathElement>;
  renderData: Record<string, unknown>[];
  strokeWidth: number;
  useDataTransitionPath: boolean;
  visibleStroke: string;
  xAccessor: (datum: Record<string, unknown>) => Date;
  xScale: (value: Date) => number | undefined;
}) {
  if (useDataTransitionPath && animatedPathD) {
    return (
      <path
        d={animatedPathD}
        fill="none"
        ref={pathRef}
        stroke={visibleStroke}
        strokeLinecap="round"
        strokeWidth={strokeWidth}
      />
    );
  }

  return (
    <LinePath
      curve={curve}
      data={renderData}
      innerRef={pathRef}
      stroke={visibleStroke}
      strokeLinecap="round"
      strokeWidth={strokeWidth}
      x={(d) => xScale(xAccessor(d)) ?? 0}
      y={getY}
    />
  );
}

export function Line({
  dataKey,
  yAxisId,
  stroke = chartCssVars.linePrimary,
  strokeWidth = 2.5,
  curve = curveNatural,
  animate = true,
  fadeEdges = true,
  showHighlight = true,
  showMarkers = false,
  markers,
  dashFromIndex,
  dashArray = "6,4",
  loading,
  loadingStroke = chartCssVars.foreground,
  loadingStrokeOpacity = 0.5,
  loadingPulseMode,
  onLoadingPulseCycleComplete,
  loadingStyle = "pulse",
}: LineProps) {
  // Stable slice only: hover state lives inside `<SeriesHoverDim>` and
  // `<SeriesHighlightLayer>` so this component (and its expensive
  // <SeriesDashTailOverlay> child) does not re-render on cursor motion.
  // The reveal-clip is now a single shared clipPath at the chart-shell
  // level (`time-series-chart-shell.tsx`); we no longer render a per-line
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
    yDomainTweenDuration,
  } = useChartStable();
  const yScale = useYScale(yAxisId);
  const useDataTransitionPath = animate && chartPhase === "ready";
  const { pathD: animatedPathD } = useAnimatedSeriesPath({
    chartPhase,
    curve,
    dataKey,
    durationMs: yDomainTweenDuration,
    enabled: useDataTransitionPath,
    innerWidth,
    renderData,
    xAccessor,
    xScale,
    yScale,
  });

  const pulse = useSeriesLoadingPulse({
    chartPhase,
    loading,
    loadingPulseMode,
    notifyLoadingPulseComplete,
    onCycleComplete: onLoadingPulseCycleComplete,
  });
  const effectiveShowHighlight = showHighlight && !pulse.showLoadingPulse;

  const seriesIndex = useMemo(() => {
    const index = lines.findIndex((line) => line.dataKey === dataKey);
    return index >= 0 ? index : 0;
  }, [lines, dataKey]);

  const pathRef = useRef<SVGPathElement>(null);
  const { pathLength, pathD } = usePathStrokeMetrics(pathRef, [
    renderData,
    innerWidth,
    dashFromIndex,
    animate,
    useDataTransitionPath ? animatedPathD : null,
  ]);

  const reactId = useId();
  const gradientId = `line-gradient-${dataKey}-${reactId}`;

  const getY = useCallback(
    (d: Record<string, unknown>) => {
      const value = d[dataKey];
      return typeof value === "number" ? (yScale(value) ?? 0) : 0;
    },
    [dataKey, yScale]
  );

  const hasDashTail = resolveDashTailBounds(dashFromIndex, data.length);
  const fadeSides = resolveFadeSides(fadeEdges);
  const lineStroke = fadeSides.any ? `url(#${gradientId})` : stroke;
  const fadeStops = fadeSides.any ? fadeGradientStops(fadeSides) : null;
  const showSeriesStroke = isSeriesVisiblePhase(chartPhase);
  let visibleStroke = "transparent";
  if (showSeriesStroke && !hasDashTail) {
    visibleStroke = lineStroke;
  }

  return (
    <>
      {fadeStops ? (
        <defs>
          <linearGradient id={gradientId} {...viewportFadeGradientAttrs(innerWidth)}>
            {fadeStops.map((stop) => (
              <stop key={stop.offset} offset={stop.offset} style={{ stopColor: stroke, stopOpacity: stop.opacity }} />
            ))}
          </linearGradient>
        </defs>
      ) : null}

      <SeriesHoverDim dimOpacity={0.3} enabled={effectiveShowHighlight} seriesIndex={seriesIndex}>
        <LineSeriesStroke
          animatedPathD={animatedPathD}
          curve={curve}
          getY={getY}
          pathRef={pathRef}
          renderData={renderData}
          strokeWidth={strokeWidth}
          useDataTransitionPath={useDataTransitionPath}
          visibleStroke={visibleStroke}
          xAccessor={xAccessor}
          xScale={xScale}
        />

        <SeriesDashTailOverlay
          dashArray={dashArray}
          dashFromIndex={dashFromIndex}
          data={data}
          innerHeight={innerHeight}
          innerWidth={innerWidth}
          pathD={pathD}
          pathLength={pathLength}
          stroke={lineStroke}
          strokeWidth={strokeWidth}
          xAccessor={xAccessor}
          xScale={xScale}
        />
      </SeriesHoverDim>

      {showMarkers ? (
        <SeriesMarkers animate={animate} dataKey={dataKey} {...markers} {...resolveMarkerPaint(markers, stroke)} />
      ) : null}

      <SeriesHighlightLayer
        enabled={effectiveShowHighlight}
        height={innerHeight}
        pathRef={pathRef}
        stroke={stroke}
        strokeWidth={strokeWidth}
      />

      <SeriesLoadingOverlays
        curve={curve}
        innerWidth={innerWidth}
        loadingStroke={loadingStroke}
        loadingStrokeOpacity={loadingStrokeOpacity}
        loadingStyle={loadingStyle}
        pathD={pathD}
        pulse={pulse}
        strokeWidth={strokeWidth}
      />
    </>
  );
}

Line.displayName = "Line";

export default Line;
