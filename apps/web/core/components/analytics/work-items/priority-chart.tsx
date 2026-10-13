/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useMemo } from "react";
import type { ColumnDef, Row, RowData, Table } from "@tanstack/react-table";
import { observer } from "mobx-react";
import { useParams } from "next/navigation";
import { useTheme } from "next-themes";
import useSWR from "swr";
// plane package imports
import { Download } from "lucide-react";
import type { ChartXAxisDateGrouping } from "@plane/constants";
import { ANALYTICS_X_AXIS_VALUES, ANALYTICS_Y_AXIS_VALUES, CHART_COLOR_PALETTES, EChartModels } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
import { Button } from "@plane/propel/button";
import { Bar, BarChart, BarXAxis, ChartTooltip, Grid, YAxis } from "@plane/propel/charts/bar-chart";
import { EmptyStateCompact } from "@plane/propel/empty-state";
import type { TChart, TChartDatum, ChartXAxisProperty, ChartYAxisMetric } from "@plane/types";
// plane web components
import { generateExtendedColors, parseChartData, toCategorySeries } from "@/components/chart/utils";
// hooks
import { useAnalytics } from "@/hooks/store/use-analytics";
import { useProjectState } from "@/hooks/store/use-project-state";
import { AnalyticsService } from "@/services/analytics.service";
import { exportCSV } from "../export";
import { DataTable } from "../insight-table/data-table";
import { ChartLoader } from "../loaders";
import { generateBarColor } from "./utils";

declare module "@tanstack/react-table" {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData extends RowData, TValue> {
    export: {
      key: string;
      value: (row: Row<TData>) => string | number;
      label?: string;
    };
  }
}

interface Props {
  x_axis: ChartXAxisProperty;
  y_axis: ChartYAxisMetric;
  group_by?: ChartXAxisProperty;
  x_axis_date_grouping?: ChartXAxisDateGrouping;
}

const analyticsService = new AnalyticsService();
const PriorityChart = observer(function PriorityChart(props: Props) {
  const { x_axis, y_axis, group_by } = props;
  const { t } = useTranslation();
  // store hooks
  const { selectedDuration, selectedProjects, selectedCycle, selectedModule, isPeekView, isEpic } = useAnalytics();
  const { workspaceStates } = useProjectState();
  const { resolvedTheme } = useTheme();
  // router
  const params = useParams();
  const workspaceSlug = params.workspaceSlug.toString();

  const { data: priorityChartData, isLoading: priorityChartLoading } = useSWR(
    `customized-insights-chart-${workspaceSlug}-${selectedDuration}-
    ${selectedProjects}-${selectedCycle}-${selectedModule}-${props.x_axis}-${props.y_axis}-${props.group_by}-${isPeekView}-${isEpic}`,
    () =>
      analyticsService.getAdvanceAnalyticsCharts<TChart>(
        workspaceSlug,
        "custom-work-items",
        {
          // date_filter: selectedDuration,
          ...(selectedProjects?.length > 0 && { project_ids: selectedProjects?.join(",") }),
          ...(selectedCycle ? { cycle_id: selectedCycle } : {}),
          ...(selectedModule ? { module_id: selectedModule } : {}),
          ...(isEpic ? { epic: true } : {}),
          ...props,
        },
        isPeekView
      )
  );
  const parsedData = useMemo(
    () =>
      priorityChartData && parseChartData(priorityChartData, props.x_axis, props.group_by, props.x_axis_date_grouping),
    [priorityChartData, props.x_axis, props.group_by, props.x_axis_date_grouping]
  );
  const chart_model = props.group_by ? EChartModels.STACKED : EChartModels.BASIC;

  const chart = useMemo((): { data: TChartDatum[]; series: Array<{ key: string; color: string; label?: string }> } => {
    if (!parsedData) return { data: [], series: [] };
    const baseColors = CHART_COLOR_PALETTES[0]?.[resolvedTheme === "dark" ? "dark" : "light"] ?? [];
    if (chart_model === EChartModels.BASIC) {
      const categories = toCategorySeries(parsedData.data, {
        valueOf: (datum) => Number(datum.count ?? 0),
        colorOf: (datum) => generateBarColor(datum.key, { x_axis, y_axis, group_by }, baseColors, workspaceStates),
      });
      return categories;
    }
    const schemaKeys = Object.keys(parsedData.schema);
    const extendedColors = generateExtendedColors(baseColors, schemaKeys.length);
    return {
      data: parsedData.data,
      series: schemaKeys.map((key, index) => ({ key, label: parsedData.schema[key], color: extendedColors[index] })),
    };
  }, [chart_model, group_by, parsedData, resolvedTheme, workspaceStates, x_axis, y_axis]);

  const yAxisLabel = useMemo(
    () => ANALYTICS_Y_AXIS_VALUES.find((item) => item.value === props.y_axis)?.label ?? props.y_axis,
    [props.y_axis]
  );
  const xAxisLabel = useMemo(
    () => ANALYTICS_X_AXIS_VALUES.find((item) => item.value === props.x_axis)?.label ?? props.x_axis,
    [props.x_axis]
  );

  const defaultColumns: ColumnDef<TChartDatum>[] = useMemo(
    () => [
      {
        accessorKey: "name",
        header: () => xAxisLabel,
        meta: {
          export: {
            key: xAxisLabel,
            value: (row) => row.original.name,
            label: xAxisLabel,
          },
        },
      },
      {
        accessorKey: "count",
        header: () => <div className="text-right">Count</div>,
        cell: ({ row }) => <div className="text-right">{row.original.count}</div>,
        meta: {
          export: {
            key: "Count",
            value: (row) => row.original.count,
            label: "Count",
          },
        },
      },
    ],
    [xAxisLabel]
  );

  const columns: ColumnDef<TChartDatum>[] = useMemo(
    () =>
      parsedData
        ? Object.keys(parsedData?.schema ?? {}).map((key) => ({
            accessorKey: key,
            header: () => <div className="text-right">{parsedData.schema[key]}</div>,
            cell: ({ row }) => <div className="text-right">{row.original[key]}</div>,
            meta: {
              export: {
                key,
                value: (row) => row.original[key],
                label: parsedData.schema[key],
              },
            },
          }))
        : [],
    [parsedData]
  );

  return (
    <div className="flex flex-col gap-12">
      {priorityChartLoading ? (
        <ChartLoader />
      ) : parsedData?.data && parsedData.data.length > 0 ? (
        <>
          <BarChart
            data={chart.data}
            xDataKey="name"
            stacked
            barGap={0.4}
            aspectRatio="auto"
            className="h-[370px] w-full"
            margin={{ left: 44, right: 16, bottom: 44 }}
          >
            <Grid horizontal strokeDasharray="3 4" />
            {chart.series.map((entry) => (
              <Bar key={entry.key} dataKey={entry.key} fill={entry.color} lineCap={4} />
            ))}
            <BarXAxis />
            <YAxis />
            <ChartTooltip
              showCrosshair={false}
              rows={(point) =>
                chart_model === EChartModels.BASIC
                  ? [
                      {
                        color: String(point.color),
                        label: t("common.no_of", { entity: yAxisLabel.replace("_", " ") }),
                        value: String(point.count),
                      },
                    ]
                  : chart.series
                      .filter((entry) => Number(point[entry.key]) > 0)
                      .map((entry) => ({
                        color: entry.color,
                        label: entry.label ?? entry.key,
                        value: String(point[entry.key]),
                      }))
              }
            />
          </BarChart>
          <DataTable
            data={parsedData.data}
            columns={[...defaultColumns, ...columns]}
            searchPlaceholder={`${parsedData.data.length} ${xAxisLabel}`}
            actions={(table: Table<TChartDatum>) => (
              <Button
                variant="secondary"
                prependIcon={<Download className="h-3.5 w-3.5" />}
                onClick={() => exportCSV(table.getRowModel().rows, [...defaultColumns, ...columns], workspaceSlug)}
              >
                <div>{t("exporter.csv.short_description")}</div>
              </Button>
            )}
          />
        </>
      ) : (
        <EmptyStateCompact
          assetKey="unknown"
          assetClassName="size-20"
          rootClassName="border border-subtle px-5 py-10 md:py-20 md:px-20"
          title={t("workspace_empty_state.analytics_work_items.title")}
        />
      )}
    </div>
  );
});

export default PriorityChart;
