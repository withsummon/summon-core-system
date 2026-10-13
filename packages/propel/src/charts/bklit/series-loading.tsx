"use client";

import { useCallback, useState } from "react";
import type { ChartPhase, LoadingStyle } from "./chart-phase";
import { type LineLoadingPulseMode, LineLoadingPulseStroke } from "./line-loading-pulse";
import { LINE_LOADING_LOOP_PAUSE_MS, resolveLineLoadingPulseMode } from "./line-loading-timing";
import { LineLoadingSweep } from "./loading-sweep";

// biome-ignore lint/suspicious/noExplicitAny: d3 curve factory type
type CurveFactory = any;

export interface SeriesLoadingPulse {
  pulseMode: LineLoadingPulseMode | null;
  pulseEpoch: number;
  showLoadingPulse: boolean;
  onPulseComplete: () => void;
}

/**
 * Loading pulse state for one series. A looping pulse restarts after a short pause;
 * an exit or enter pulse tells the chart phase orchestrator it finished.
 */
export function useSeriesLoadingPulse({
  chartPhase,
  loading,
  loadingPulseMode,
  notifyLoadingPulseComplete,
  onCycleComplete,
}: {
  chartPhase: ChartPhase;
  loading?: boolean;
  loadingPulseMode?: LineLoadingPulseMode;
  notifyLoadingPulseComplete?: () => void;
  onCycleComplete?: () => void;
}): SeriesLoadingPulse {
  const pulseMode = resolvePulseMode(chartPhase, loading, loadingPulseMode);
  const [pulseEpoch, setPulseEpoch] = useState(0);

  const onPulseComplete = useCallback(() => {
    onCycleComplete?.();
    if (pulseMode === "loop") {
      window.setTimeout(() => {
        setPulseEpoch((epoch) => epoch + 1);
      }, LINE_LOADING_LOOP_PAUSE_MS);
      return;
    }
    notifyLoadingPulseComplete?.();
  }, [notifyLoadingPulseComplete, onCycleComplete, pulseMode]);

  return { pulseMode, pulseEpoch, showLoadingPulse: pulseMode != null, onPulseComplete };
}

/** Draws the loading sweep or pulse over a series while the chart loads. */
export function SeriesLoadingOverlays({
  pulse,
  curve,
  innerWidth,
  loadingStroke,
  loadingStrokeOpacity,
  loadingStyle,
  pathD,
  strokeWidth,
  withArea = false,
}: {
  pulse: SeriesLoadingPulse;
  curve: CurveFactory;
  innerWidth: number;
  loadingStroke: string;
  loadingStrokeOpacity: number;
  loadingStyle: LoadingStyle;
  pathD: string | null;
  strokeWidth: number;
  /** Sweep the filled silhouette under the line too. */
  withArea?: boolean;
}) {
  if (!pulse.showLoadingPulse || innerWidth <= 0) {
    return null;
  }

  // Sweep owns every loading mode (loop + the exit/enter transitions) and draws its own silhouette.
  if (loadingStyle === "sweep") {
    return (
      <LineLoadingSweep
        curve={curve}
        key="loading-sweep"
        mode={pulse.pulseMode ?? "loop"}
        onTransitionComplete={pulse.onPulseComplete}
        stroke={loadingStroke}
        strokeOpacity={loadingStrokeOpacity}
        strokeWidth={strokeWidth}
        withArea={withArea}
      />
    );
  }

  if (!pathD) {
    return null;
  }

  return (
    <LineLoadingPulseStroke
      key="loading-pulse"
      loopEpoch={pulse.pulseEpoch}
      mode={pulse.pulseMode ?? undefined}
      onCycleComplete={pulse.onPulseComplete}
      pathD={pathD}
      stroke={loadingStroke}
      strokeOpacity={loadingStrokeOpacity}
      strokeWidth={strokeWidth}
    />
  );
}

function resolvePulseMode(
  chartPhase: ChartPhase,
  loading: boolean | undefined,
  loadingPulseMode: LineLoadingPulseMode | undefined
): LineLoadingPulseMode | null {
  if (loading === false) {
    return null;
  }
  if (loadingPulseMode) {
    return loadingPulseMode;
  }
  return loading === true ? "loop" : resolveLineLoadingPulseMode(chartPhase);
}
