/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useMemo } from "react";
import { observer } from "mobx-react";
import { useParams } from "next/navigation";
import useSWR from "swr";
// plane package imports
import { useTranslation } from "@plane/i18n";
import { Area, AreaChart, ChartTooltip, Grid, XAxis, YAxis } from "@plane/propel/charts/area-chart";
import { EmptyStateCompact } from "@plane/propel/empty-state";
import type { IChartResponse } from "@plane/types";
// components
import { ChartSeriesLegend } from "@/components/chart/series-legend";
// hooks
import { useAnalytics } from "@/hooks/store/use-analytics";
// services
import { AnalyticsService } from "@/services/analytics.service";
// plane web components
import AnalyticsSectionWrapper from "../analytics-section-wrapper";
import { ChartLoader } from "../loaders";

const analyticsService = new AnalyticsService();

const SERIES = [
  { key: "completed_issues", label: "Resolved", color: "var(--chart-success)" },
  { key: "created_issues", label: "Created", color: "var(--chart-1)" },
] as const;

const CreatedVsResolved = observer(function CreatedVsResolved() {
  const {
    selectedDuration,
    selectedDurationLabel,
    selectedProjects,
    selectedCycle,
    selectedModule,
    isPeekView,
    isEpic,
  } = useAnalytics();
  const params = useParams();
  const { t } = useTranslation();
  const workspaceSlug = params.workspaceSlug.toString();
  const { data: createdVsResolvedData, isLoading: isCreatedVsResolvedLoading } = useSWR(
    `created-vs-resolved-${workspaceSlug}-${selectedDuration}-${selectedProjects}-${selectedCycle}-${selectedModule}-${isPeekView}-${isEpic}`,
    () =>
      analyticsService.getAdvanceAnalyticsCharts<IChartResponse>(
        workspaceSlug,
        "work-items",
        {
          // date_filter: selectedDuration,
          ...(selectedProjects?.length > 0 && { project_ids: selectedProjects?.join(",") }),
          ...(selectedCycle ? { cycle_id: selectedCycle } : {}),
          ...(selectedModule ? { module_id: selectedModule } : {}),
          ...(isEpic ? { epic: true } : {}),
        },
        isPeekView
      )
  );
  const parsedData = useMemo(
    () =>
      (createdVsResolvedData?.data ?? []).map((datum) => ({
        date: new Date(datum.key),
        completed_issues: Number(datum.completed_issues ?? 0),
        created_issues: Number(datum.created_issues ?? 0),
      })),
    [createdVsResolvedData]
  );
  const totals = useMemo(
    () =>
      SERIES.map((series) => ({
        label: series.label,
        color: series.color,
        value: parsedData.reduce((sum, datum) => sum + datum[series.key], 0),
      })),
    [parsedData]
  );

  return (
    <AnalyticsSectionWrapper
      title={t("workspace_analytics.created_vs_resolved")}
      subtitle={selectedDurationLabel}
      className="col-span-1"
    >
      {isCreatedVsResolvedLoading ? (
        <ChartLoader />
      ) : parsedData && parsedData.length > 0 ? (
        <div className="flex flex-col gap-3">
          <AreaChart data={parsedData} aspectRatio="auto" className="h-[320px] w-full" margin={{ left: 44, right: 16 }}>
            <Grid horizontal strokeDasharray="3 4" />
            {SERIES.map((series) => (
              <Area key={series.key} dataKey={series.key} stroke={series.color} fill={series.color} fillOpacity={0.2} />
            ))}
            <XAxis />
            <YAxis />
            <ChartTooltip
              rows={(point) =>
                SERIES.map((series) => ({
                  color: series.color,
                  label: series.label,
                  value: String(point[series.key]),
                }))
              }
            />
          </AreaChart>
          <ChartSeriesLegend items={totals} className="pl-10" />
        </div>
      ) : (
        <EmptyStateCompact
          assetKey="unknown"
          assetClassName="size-20"
          rootClassName="border border-subtle px-5 py-10 md:py-20 md:px-20"
          title={t("workspace_empty_state.analytics_work_items.title")}
        />
      )}
    </AnalyticsSectionWrapper>
  );
});

export default CreatedVsResolved;
