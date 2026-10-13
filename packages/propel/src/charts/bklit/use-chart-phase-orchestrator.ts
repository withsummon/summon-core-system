"use client";

import { useCallback, useEffect, useState } from "react";
import { type ChartPhase, type ChartStatus, resolveRestingChartPhase } from "./chart-phase";

/** Phases that draw the skeleton series rather than the real data. */
const SKELETON_PHASES = new Set<ChartPhase>(["loading", "exiting", "revealingLoading"]);

export interface UseChartPhaseOrchestratorOptions {
  chartStatus: ChartStatus;
  targetData: Record<string, unknown>[];
  skeletonData: Record<string, unknown>[];
  animationDuration: number;
  yDomainTweenDuration: number;
  /** Signature of motion URL state — replays clip reveal in Studio. */
  revealSignature?: string;
  /** Skip mount/signature enter reveal (static docs previews). */
  skipEnterReveal?: boolean;
}

export function useChartPhaseOrchestrator({
  chartStatus,
  targetData,
  skeletonData,
  animationDuration,
  yDomainTweenDuration,
  revealSignature = "",
  skipEnterReveal = false,
}: UseChartPhaseOrchestratorOptions) {
  const [chartPhase, setChartPhase] = useState<ChartPhase>(() =>
    !skipEnterReveal && chartStatus === "ready" ? "revealing" : resolveRestingChartPhase(chartStatus)
  );
  const [revealEpoch, setRevealEpoch] = useState(0);
  const [concealEpoch, setConcealEpoch] = useState(0);
  const [isLoaded, setIsLoaded] = useState(() => skipEnterReveal && chartStatus === "ready");
  const [lastInputs, setLastInputs] = useState({ chartStatus, revealSignature, animationDuration, skipEnterReveal });

  // Start transitions while rendering, so no frame paints the old phase against new props.
  if (
    lastInputs.chartStatus !== chartStatus ||
    lastInputs.revealSignature !== revealSignature ||
    lastInputs.animationDuration !== animationDuration ||
    lastInputs.skipEnterReveal !== skipEnterReveal
  ) {
    setLastInputs({ chartStatus, revealSignature, animationDuration, skipEnterReveal });
    let nextPhase = chartPhase;
    if (lastInputs.chartStatus !== chartStatus) {
      nextPhase =
        chartStatus === "ready"
          ? startReady(animationDuration, yDomainTweenDuration)
          : startLoading(animationDuration, yDomainTweenDuration);
      if (nextPhase === "exitingReady") {
        setConcealEpoch((epoch) => epoch + 1);
      }
      setIsLoaded(false);
    } else if (!skipEnterReveal && chartStatus === "ready" && chartPhase === "ready") {
      // A new reveal signature (or timing) replays the enter animation.
      nextPhase = "revealing";
      setIsLoaded(false);
    }
    setChartPhase(nextPhase);
  }

  const plotData = SKELETON_PHASES.has(chartPhase) ? skeletonData : targetData;

  /** Loading pulse exit finished — tween grid to ready spacing next. */
  const notifyLoadingPulseComplete = useCallback(() => {
    setChartPhase((phase) => (phase === "exiting" ? "gridTweenReady" : phase));
  }, []);

  /** Ready series conceal finished — tween grid to loading spacing next. */
  const notifyRevealConcealComplete = useCallback(() => {
    setChartPhase((phase) => (phase === "exitingReady" ? "gridTweenLoading" : phase));
  }, []);

  /** Grid tween finished — enter the next resting phase. */
  const notifyYDomainTweenComplete = useCallback(() => {
    setChartPhase((phase) => {
      if (phase === "gridTweenLoading") {
        return "loading";
      }
      return phase === "gridTweenReady" ? "revealing" : phase;
    });
  }, []);

  useEffect(() => {
    if (chartPhase !== "revealing") {
      return;
    }

    setRevealEpoch((epoch) => epoch + 1);
    if (animationDuration <= 0) {
      setChartPhase("ready");
      setIsLoaded(true);
      return;
    }

    const timer = window.setTimeout(() => {
      setChartPhase("ready");
      setIsLoaded(true);
    }, animationDuration);
    return () => window.clearTimeout(timer);
  }, [animationDuration, chartPhase]);

  return {
    chartPhase,
    plotData,
    revealEpoch,
    concealEpoch,
    isLoaded,
    notifyLoadingPulseComplete,
    notifyRevealConcealComplete,
    notifyYDomainTweenComplete,
  };
}

/** First phase of loading → ready: exit the pulse, tween the grid, or reveal at once. */
function startReady(animationDuration: number, yDomainTweenDuration: number): ChartPhase {
  if (animationDuration > 0) {
    return "exiting";
  }
  return yDomainTweenDuration > 0 ? "gridTweenReady" : "revealing";
}

/** First phase of ready → loading: conceal the series, tween the grid, or show the skeleton at once. */
function startLoading(animationDuration: number, yDomainTweenDuration: number): ChartPhase {
  if (animationDuration > 0) {
    return "exitingReady";
  }
  return yDomainTweenDuration > 0 ? "gridTweenLoading" : "loading";
}
