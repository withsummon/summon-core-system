"use client";

import { scaleLinear, scaleTime } from "@visx/scale";
import { bisector, extent } from "d3-array";
import type { Transition } from "framer-motion";
import { Children, isValidElement, memo, type ReactElement, type ReactNode, useCallback, useId, useMemo } from "react";
import { DEFAULT_ANIMATION_EASING, DEFAULT_CHART_ENTER_TRANSITION } from "./animation";
import {
  isClipExcludedComponent,
  isPostOverlayComponent,
  isUnderlayComponent,
  resolveChartChildElement,
} from "./chart-child-passthrough";
import { ChartLoadingLabel } from "./chart-loading-label";
import { ChartProvider, type LineConfig, type Margin } from "./chart-context";
import { isGradientDefComponent, isPatternDefComponent } from "./chart-defs";
import { shortDateFmt } from "./chart-formatters";
import {
  type ChartPhase,
  type ChartStatus,
  DEFAULT_CHART_STATUS,
  DEFAULT_Y_DOMAIN_TWEEN_MS,
  isChartInteractionPhase,
} from "./chart-phase";
import { ChartRevealClip } from "./chart-reveal-clip";
import { decimateTimeSeries, maxRenderPointsForWidth } from "./decimate-time-series";
import { filterDataByXDomain } from "./filter-data-by-x-domain";
import { generateChartSkeletonData, generateChartSkeletonFromTarget } from "./generate-chart-skeleton-data";
import { extractProjectionLineConfigs, mergeProjectionXDomainMax, mergeProjectionYDomain } from "./projection-config";
import { ReferenceAreaRegistrationContext } from "./reference-area-registration-context";
import { computeSeriesBarRevealClipPadding, computeSeriesBarWidth } from "./series-bar-layout";
import { useStaticChartPreview } from "./static-chart-preview-context";
import { useAnimatedYDomains } from "./use-animated-y-domains";
import { useChartInteraction } from "./use-chart-interaction";
import { useChartPhaseOrchestrator } from "./use-chart-phase-orchestrator";
import { useReferenceAreas } from "./use-reference-areas";
import { buildYScalesFromDomains, DEFAULT_Y_AXIS_ID, getPrimaryYScale, groupLinesByYAxisId } from "./y-axis-scales";
import { computeYDomainsByAxis } from "./y-domain-utils";

function collectNumericExtents(data: Record<string, unknown>[], dataKeys: string[]) {
  let minValue = Number.POSITIVE_INFINITY;
  let maxValue = Number.NEGATIVE_INFINITY;

  for (const d of data) {
    for (const key of dataKeys) {
      const value = d[key];
      if (typeof value === "number") {
        if (value < minValue) {
          minValue = value;
        }
        if (value > maxValue) {
          maxValue = value;
        }
      }
    }
  }

  if (minValue === Number.POSITIVE_INFINITY) {
    return { minValue: 0, maxValue: 100 };
  }

  return { minValue, maxValue };
}

function resolveTimeSeriesYDomain(
  data: Record<string, unknown>[],
  dataKeys: string[],
  yScaleDomainMax: number | undefined
): [number, number] {
  if (yScaleDomainMax != null && yScaleDomainMax > 0) {
    return [0, yScaleDomainMax * 1.1];
  }

  const { minValue, maxValue } = collectNumericExtents(data, dataKeys);

  if (minValue >= 0) {
    const top = maxValue <= 0 ? 100 : maxValue * 1.1;
    return [0, top];
  }

  const padding = (maxValue - minValue) * 0.05 || 1;
  return [minValue - padding, maxValue + padding];
}

export interface TimeSeriesChartInnerProps {
  width: number;
  height: number;
  data: Record<string, unknown>[];
  xDataKey: string;
  margin: Margin;
  animationDuration: number;
  animationEasing?: string;
  enterTransition?: Transition;
  /** Signature of motion URL state — triggers reveal replay when it changes. */
  revealSignature?: string;
  children: ReactNode;
  containerRef: React.RefObject<HTMLDivElement | null>;
  /** Series keys driving y-domain and tooltip (Line / Area / SeriesBar configs). */
  lines: LineConfig[];
  /**
   * Base SVG clipPath id for grow animation. Uniquified per chart instance so
   * multiple charts on one page do not share a clipPath (#226).
   */
  clipPathId: string;
  /** Optional ComposedChart bar layout (forwarded into context). */
  composedBarDataKeys?: string[];
  composedBarSize?: number;
  composedMaxBarSize?: number;
  composedBarGap?: number;
  composedStacked?: boolean;
  composedStackOffsets?: Map<number, Map<string, number>>;
  composedStackGap?: number;
  /** When set, drives the y-axis max instead of scanning `lines` (e.g. stacked bar totals). */
  yScaleDomainMax?: number;
  /** Loading vs ready — drives chart phase until transition orchestration lands. */
  chartStatus?: ChartStatus;
  loadingLabel?: string;
  /** Animate y-domain on status / data transitions. Default: true */
  yDomainTween?: boolean;
  yDomainTweenDuration?: number;
  /** Visible x-domain for brush zoom. When set, y-domain and series use data in this range. */
  xDomain?: [Date, Date];
  /** Full dataset length for x-scale padding when `xDomain` is set. */
  xDomainSlotCount?: number;
  /** Tween y-domain when the visible x-range changes during the ready phase. */
  tweenYDomainOnXDomainChange?: boolean;
}

export function TimeSeriesChartInner(props: TimeSeriesChartInnerProps) {
  const { width, height } = props;
  if (width < 10 || height < 10) {
    return null;
  }
  return <TimeSeriesChartCore {...props} />;
}

const TimeSeriesChartCore = memo(function TimeSeriesChartCore({
  width,
  height,
  data,
  xDataKey,
  margin,
  animationDuration,
  animationEasing = DEFAULT_ANIMATION_EASING,
  enterTransition,
  revealSignature = "",
  children,
  containerRef,
  lines,
  clipPathId,
  composedBarDataKeys,
  composedBarSize,
  composedMaxBarSize,
  composedBarGap,
  composedStacked,
  composedStackOffsets,
  composedStackGap,
  yScaleDomainMax,
  chartStatus = DEFAULT_CHART_STATUS,
  loadingLabel,
  yDomainTween = true,
  yDomainTweenDuration = DEFAULT_Y_DOMAIN_TWEEN_MS,
  xDomain,
  xDomainSlotCount,
  tweenYDomainOnXDomainChange = false,
}: TimeSeriesChartInnerProps) {
  // Unique per instance — shared clipPath ids crop later charts (#226).
  const uniqueClipPathId = `${clipPathId}-${useId().replace(/:/g, "")}`;
  const staticPreview = useStaticChartPreview();
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  const resolveYDomain = useCallback(
    (sourceData: Record<string, unknown>[], dataKeys: string[]) => {
      const axisGroups = groupLinesByYAxisId(lines);
      const usesDefaultOnly = axisGroups.size === 1 && axisGroups.has(DEFAULT_Y_AXIS_ID);
      const domainMax = usesDefaultOnly && yScaleDomainMax != null ? yScaleDomainMax : undefined;
      return resolveTimeSeriesYDomain(sourceData, dataKeys, domainMax);
    },
    [lines, yScaleDomainMax]
  );

  const skeletonData = useMemo(() => {
    const primaryKey = lines[0]?.dataKey ?? "value";
    if (data.length === 0) {
      return generateChartSkeletonData({ dataKey: primaryKey });
    }
    return generateChartSkeletonFromTarget(data, primaryKey);
  }, [data, lines]);

  const {
    chartPhase,
    plotData,
    revealEpoch,
    concealEpoch,
    isLoaded,
    notifyLoadingPulseComplete,
    notifyRevealConcealComplete,
    notifyYDomainTweenComplete,
  } = useChartPhaseOrchestrator({
    animationDuration,
    chartStatus,
    revealSignature,
    skeletonData,
    skipEnterReveal: staticPreview,
    targetData: data,
    yDomainTweenDuration,
  });

  const xAccessor = useCallback(
    (d: Record<string, unknown>): Date => {
      const value = d[xDataKey];
      return value instanceof Date ? value : new Date(value as string | number);
    },
    [xDataKey]
  );

  const bisectDate = useMemo(() => bisector<Record<string, unknown>, Date>((d) => xAccessor(d)).left, [xAccessor]);

  const visiblePlotData = useMemo(() => {
    if (!xDomain) {
      return plotData;
    }
    return filterDataByXDomain(plotData, xDomain, xAccessor);
  }, [plotData, xDomain, xAccessor]);

  const projectionConfigs = useMemo(() => extractProjectionLineConfigs(children), [children]);

  const xScale = useMemo(
    () =>
      scaleTime({ range: [0, innerWidth], domain: resolveTimeDomain(plotData, xAccessor, xDomain, projectionConfigs) }),
    [innerWidth, plotData, projectionConfigs, xAccessor, xDomain]
  );

  // When brushing, keep the full series for path rendering so edge fades stay
  // anchored to the viewport while the line pans through them. Y-domain and
  // interaction still use the filtered visible slice.
  const seriesSourceData = xDomain ? plotData : visiblePlotData;

  const renderData = useMemo(() => {
    const valueKeys = lines.map((line) => line.dataKey);
    return decimateTimeSeries(seriesSourceData, maxRenderPointsForWidth(innerWidth), valueKeys);
  }, [seriesSourceData, innerWidth, lines]);

  const columnWidth = useMemo(() => {
    const slotCount = xDomain && xDomainSlotCount != null ? xDomainSlotCount : visiblePlotData.length;
    if (slotCount < 2) {
      return 0;
    }
    return innerWidth / (slotCount - 1);
  }, [innerWidth, visiblePlotData.length, xDomain, xDomainSlotCount]);

  const yDomainSkeletonByAxis = useMemo(
    () =>
      computeYDomainsByAxis({
        lines,
        resolveDomain: (dataKeys) => resolveYDomain(skeletonData, dataKeys),
      }),
    [lines, resolveYDomain, skeletonData]
  );

  const yDomainTargetByAxis = useMemo(() => {
    const base = computeYDomainsByAxis({
      lines,
      resolveDomain: (dataKeys) => resolveYDomain(xDomain ? visiblePlotData : data, dataKeys),
    });
    return mergeProjectionYDomains(base, projectionConfigs);
  }, [data, lines, projectionConfigs, resolveYDomain, visiblePlotData, xDomain]);

  const animatedYDomainsByAxis = useAnimatedYDomains({
    chartPhase,
    durationMs: yDomainTweenDuration,
    enabled: yDomainTween,
    onSettled: notifyYDomainTweenComplete,
    skeletonByAxis: yDomainSkeletonByAxis,
    targetByAxis: yDomainTargetByAxis,
    tweenOnTargetChange: yDomainTween || (tweenYDomainOnXDomainChange && xDomain != null),
  });

  const yScales = useMemo(
    () =>
      buildYScalesFromDomains({
        domainsByAxis: animatedYDomainsByAxis,
        innerHeight,
        lines,
      }),
    [animatedYDomainsByAxis, innerHeight, lines]
  );

  const yScale = getPrimaryYScale(yScales, scaleLinear({ range: [innerHeight, 0], domain: [0, 100], nice: true }));

  const dateLabels = useMemo(
    () => visiblePlotData.map((d) => shortDateFmt.format(xAccessor(d))),
    [visiblePlotData, xAccessor]
  );

  const canInteract = isLoaded && isChartInteractionPhase(chartPhase);

  const { tooltipData, setTooltipData, selection, clearSelection, interactionHandlers, interactionStyle } =
    useChartInteraction({
      bisectDate,
      canInteract,
      data: visiblePlotData,
      lines,
      margin,
      xAccessor,
      xScale,
      yScale,
      yScales,
    });

  const { defsChildren, clipExcludedChildren, underlayChildren, preOverlayChildren, postOverlayChildren } =
    partitionChartChildren(children);

  const { referenceAreas, registration: referenceAreaRegistration } = useReferenceAreas(children);

  // ChartProvider memoizes each field, so a fresh object here does not re-render consumers.
  const contextValue = {
    data: visiblePlotData,
    renderData,
    xScale,
    yScale,
    yScales,
    width,
    height,
    innerWidth,
    innerHeight,
    margin,
    columnWidth,
    tooltipData,
    setTooltipData,
    containerRef,
    lines,
    referenceAreas,
    chartPhase,
    chartStatus,
    loadingLabel,
    yDomainTweenDuration,
    yDomainSkeletonByAxis,
    yDomainTargetByAxis,
    isLoaded,
    animationDuration,
    animationEasing,
    enterTransition,
    revealEpoch,
    notifyLoadingPulseComplete,
    xAccessor,
    dateLabels,
    xDomain,
    xDomainSlotCount,
    selection,
    clearSelection,
    composedBarDataKeys,
    composedBarSize,
    composedMaxBarSize,
    composedBarGap,
    composedStacked,
    composedStackOffsets,
    composedStackGap,
  };

  const useClipReveal = !staticPreview && renderData.length > 1 && innerWidth > 0 && animationDuration > 0;

  const revealClipPadding = useMemo(
    () =>
      computeComposedBarClipPadding({
        columnWidth,
        composedBarDataKeys,
        composedBarGap,
        composedBarSize,
        composedMaxBarSize,
        composedStacked,
        dataLength: plotData.length,
        innerWidth,
      }),
    [
      columnWidth,
      composedBarDataKeys,
      composedBarGap,
      composedBarSize,
      composedMaxBarSize,
      composedStacked,
      innerWidth,
      plotData.length,
    ]
  );

  return (
    <ReferenceAreaRegistrationContext.Provider value={referenceAreaRegistration}>
      <ChartProvider value={contextValue}>
        <svg aria-hidden="true" height={height} width={width}>
          <defs>
            {defsChildren}
            {useClipReveal ? (
              <ShellRevealClip
                animationDuration={animationDuration}
                chartPhase={chartPhase}
                clipPathId={uniqueClipPathId}
                concealEpoch={concealEpoch}
                enterTransition={enterTransition}
                height={innerHeight + 20}
                onConcealComplete={notifyRevealConcealComplete}
                padding={revealClipPadding}
                revealEpoch={revealEpoch}
                targetWidth={innerWidth}
              />
            ) : null}
          </defs>

          <rect fill="transparent" height={height} width={width} x={0} y={0} />

          <g {...interactionHandlers} style={interactionStyle} transform={`translate(${margin.left},${margin.top})`}>
            <rect fill="transparent" height={innerHeight} width={innerWidth} x={0} y={0} />

            {clipExcludedChildren}
            {underlayChildren}
            {useClipReveal ? <g clipPath={`url(#${uniqueClipPathId})`}>{preOverlayChildren}</g> : preOverlayChildren}
            {postOverlayChildren}
          </g>
        </svg>
        {showLoadingLabel(chartPhase, loadingLabel) ? (
          <ChartLoadingLabel exiting={chartPhase !== "loading"} text={loadingLabel} />
        ) : null}
      </ChartProvider>
    </ReferenceAreaRegistrationContext.Provider>
  );
});

/** Loading label stays up through the pulse exit and grid tween, then fades as the series reveals. */
function showLoadingLabel(chartPhase: ChartPhase, loadingLabel: string | undefined): boolean {
  if (!loadingLabel?.trim()) {
    return false;
  }
  return (
    chartPhase === "loading" ||
    chartPhase === "exiting" ||
    chartPhase === "gridTweenReady" ||
    chartPhase === "revealingLoading"
  );
}

/** Sorts chart children into SVG layers: defs, clip-excluded chrome, underlays, series, and overlays. */
function partitionChartChildren(children: ReactNode) {
  const defsChildren: ReactElement[] = [];
  const clipExcludedChildren: ReactElement[] = [];
  const underlayChildren: ReactElement[] = [];
  const preOverlayChildren: ReactElement[] = [];
  const postOverlayChildren: ReactElement[] = [];

  // `toArray` gives every child a stable key derived from its own key or position.
  for (const child of Children.toArray(children)) {
    if (!isValidElement(child)) {
      continue;
    }
    const resolvedChild = resolveChartChildElement(child);
    if (isGradientDefComponent(resolvedChild)) {
      defsChildren.push(resolvedChild);
    } else if (isPatternDefComponent(resolvedChild)) {
      preOverlayChildren.push(resolvedChild);
    } else if (isPostOverlayComponent(resolvedChild)) {
      postOverlayChildren.push(resolvedChild);
    } else if (isClipExcludedComponent(resolvedChild)) {
      clipExcludedChildren.push(resolvedChild);
    } else if (isUnderlayComponent(resolvedChild)) {
      underlayChildren.push(resolvedChild);
    } else {
      preOverlayChildren.push(resolvedChild);
    }
  }

  return { defsChildren, clipExcludedChildren, underlayChildren, preOverlayChildren, postOverlayChildren };
}

/** Widens each axis domain to fit projection lines, adding axes that only projections use. */
function mergeProjectionYDomains(
  base: Record<string, [number, number]>,
  projectionConfigs: ReturnType<typeof extractProjectionLineConfigs>
): Record<string, [number, number]> {
  if (projectionConfigs.length === 0) {
    return base;
  }
  const merged: Record<string, [number, number]> = { ...base };
  for (const axisId of Object.keys(base)) {
    merged[axisId] = mergeProjectionYDomain(base[axisId] ?? [0, 100], projectionConfigs, axisId);
  }
  for (const config of projectionConfigs) {
    if (!merged[config.yAxisId]) {
      merged[config.yAxisId] = mergeProjectionYDomain([0, 100], projectionConfigs, config.yAxisId);
    }
  }
  return merged;
}

/**
 * Time extent of the data, or the brushed `xDomain`. Without a brush the domain stretches to the
 * projection horizon; with one, the brush track already includes it.
 */
function resolveTimeDomain(
  plotData: Record<string, unknown>[],
  xAccessor: (d: Record<string, unknown>) => Date,
  xDomain: [Date, Date] | undefined,
  projectionConfigs: ReturnType<typeof extractProjectionLineConfigs>
): [number, number] {
  if (xDomain) {
    return [xDomain[0].getTime(), xDomain[1].getTime()];
  }
  const [min, max] = extent(plotData, (d) => xAccessor(d).getTime());
  const minTime = min ?? 0;
  return [minTime, mergeProjectionXDomainMax(max ?? minTime, projectionConfigs)];
}

/** Extra clip width so composed bars at the edges are not cut off mid-bar during the reveal. */
function computeComposedBarClipPadding({
  composedBarDataKeys,
  composedBarGap,
  composedStacked,
  ...layout
}: {
  columnWidth: number;
  composedBarDataKeys?: string[];
  composedBarGap?: number;
  composedBarSize?: number;
  composedMaxBarSize?: number;
  composedStacked?: boolean;
  dataLength: number;
  innerWidth: number;
}): number {
  if (!composedBarDataKeys?.length) {
    return 0;
  }
  const seriesCount = composedBarDataKeys.length;
  const barWidth = computeSeriesBarWidth({ ...layout, composedBarGap, seriesCount, stacked: composedStacked });
  return computeSeriesBarRevealClipPadding({ barWidth, gap: composedBarGap, seriesCount, stacked: composedStacked });
}

/** Shared clip that grows the series in on reveal and wipes them out on conceal (ready → loading). */
function ShellRevealClip({
  animationDuration,
  chartPhase,
  concealEpoch,
  enterTransition,
  onConcealComplete,
  revealEpoch,
  ...clipProps
}: {
  animationDuration: number;
  chartPhase: ChartPhase;
  clipPathId: string;
  concealEpoch: number;
  enterTransition?: Transition;
  height: number;
  onConcealComplete: () => void;
  padding: number;
  revealEpoch: number;
  targetWidth: number;
}) {
  const concealing = chartPhase === "exitingReady" && animationDuration > 0;
  return (
    <ChartRevealClip
      {...clipProps}
      animating={chartPhase === "revealing" || concealing}
      enterTransition={
        enterTransition ??
        ({ ...DEFAULT_CHART_ENTER_TRANSITION, duration: animationDuration / 1000 } satisfies Transition)
      }
      mode={concealing ? "conceal" : "reveal"}
      onComplete={concealing ? onConcealComplete : undefined}
      revealEpoch={concealing ? concealEpoch : revealEpoch}
    />
  );
}
