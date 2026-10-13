"use client";

import { createContext, type ReactNode, useContext, useMemo } from "react";
import { type ChartConfigValue, DEFAULT_CHART_CONFIG } from "./chart-config";

const ChartConfigContext = createContext<ChartConfigValue | null>(null);

export interface ChartConfigProviderProps {
  value?: Partial<ChartConfigValue>;
  children: ReactNode;
}

export function ChartConfigProvider({ value, children }: ChartConfigProviderProps) {
  const merged = useMemo<ChartConfigValue>(
    () => ({
      ...DEFAULT_CHART_CONFIG,
      ...value,
    }),
    [value]
  );

  return <ChartConfigContext.Provider value={merged}>{children}</ChartConfigContext.Provider>;
}

export function useChartConfig(): ChartConfigValue {
  return useContext(ChartConfigContext) ?? DEFAULT_CHART_CONFIG;
}
