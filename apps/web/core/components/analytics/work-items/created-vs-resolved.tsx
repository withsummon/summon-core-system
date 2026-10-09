/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useMemo, useCallback } from "react";
// plane package imports
import { useTranslation } from "@plane/i18n";
import { AreaChart } from "@plane/propel/charts/area-chart";
import { EmptyStateCompact } from "@plane/propel/empty-state";
import { renderFormattedDate } from "@plane/utils";
// hooks
// services
// plane web components
import AnalyticsSectionWrapper from "../analytics-section-wrapper";
import { ChartLoader } from "../loaders";

import { api } from "@summon/convex/api";
import { AnalyticsError, useAnalyticsReport, type AnalyticsScope } from "../analytics-wrapper";
import { readReportPages } from "@/components/convex-core/reporting/pages";
import type { ConvexReactClient } from "convex/react";
const CreatedVsResolved = function CreatedVsResolved({
  scope,
  generation,
}: {
  scope: AnalyticsScope;
  generation: number;
}) {
  const { t } = useTranslation();
  const read = useCallback(
    async (client: ConvexReactClient, signal: AbortSignal) => {
      const pages = await readReportPages(
        (cursor) => client.query(api.reporting.analytics.trend, { scope, paginationOpts: { cursor, numItems: 100 } }),
        signal,
        () => {}
      );
      const { from, to, daily } = pages[0];
      if (from === null || to === null) return [];
      const counts = new Map<string, { created: number; completed: number }>();
      for (const page of pages)
        for (const row of page.months) {
          const previous = counts.get(row.key);
          counts.set(row.key, {
            created: row.created + (previous?.created ?? 0),
            completed: row.completed + (previous?.completed ?? 0),
          });
        }
      const data = [];
      let current = new Date(`${from}T00:00:00Z`);
      const end = new Date(`${to}T00:00:00Z`);
      while (current <= end) {
        const key = current.toISOString().slice(0, 10);
        const row = counts.get(key) ?? { created: 0, completed: 0 };
        data.push({
          key,
          name: renderFormattedDate(key) ?? key,
          count: row.created + (daily ? row.completed : 0),
          created_issues: row.created,
          completed_issues: row.completed,
        });
        current = daily
          ? new Date(current.setUTCDate(current.getUTCDate() + 1))
          : new Date(current.setUTCMonth(current.getUTCMonth() + 1));
      }
      return data;
    },
    [scope]
  );
  const report = useAnalyticsReport(read, generation);
  const parsedData = report.data;
  const isCreatedVsResolvedLoading = report.isLoading;
  const areas = useMemo(
    () => [
      {
        key: "completed_issues",
        label: "Resolved",
        fill: "#19803833",
        fillOpacity: 1,
        stackId: "bar-one",
        showDot: false,
        smoothCurves: true,
        strokeColor: "#198038",
        strokeOpacity: 1,
      },
      {
        key: "created_issues",
        label: "Created",
        fill: "#1192E833",
        fillOpacity: 1,
        stackId: "bar-one",
        showDot: false,
        smoothCurves: true,
        strokeColor: "#1192E8",
        strokeOpacity: 1,
      },
    ],
    []
  );

  return (
    <AnalyticsSectionWrapper title={t("workspace_analytics.created_vs_resolved")} className="col-span-1">
      <AnalyticsError error={report.error} />
      {isCreatedVsResolvedLoading ? (
        <ChartLoader />
      ) : parsedData && parsedData.length > 0 ? (
        <AreaChart
          className="h-[350px] w-full"
          data={parsedData}
          areas={areas}
          xAxis={{
            key: "name",
            label: t("date"),
          }}
          yAxis={{
            key: "count",
            label: t("common.no_of", { entity: t("work_items") }),
            offset: -60,
            dx: -24,
          }}
          legend={{
            align: "left",
            verticalAlign: "bottom",
            layout: "horizontal",
            wrapperStyles: {
              justifyContent: "start",
              alignContent: "start",
              paddingLeft: "40px",
              paddingTop: "10px",
            },
          }}
        />
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
};

export default CreatedVsResolved;
