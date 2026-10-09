/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useCallback, useMemo } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import type { FunctionArgs } from "convex/server";
import type { ConvexReactClient } from "convex/react";
import { api } from "@summon/convex/api";
import { useTheme } from "next-themes";
import { Download } from "lucide-react";
import { CHART_COLOR_PALETTES } from "@plane/constants";
import { Button } from "@plane/propel/button";
import { BarChart } from "@plane/propel/charts/bar-chart";
import type { TBarItem } from "@plane/types";
import { readReportPages } from "@/components/convex-core/reporting/pages";
import { generateExtendedColors } from "@/components/chart/utils";
import { AnalyticsError, useAnalyticsReport, type AnalyticsScope } from "../analytics-wrapper";
import { analyticsAxes } from "../select/analytics-params";
import { DataTable } from "../insight-table/data-table";
import { ChartLoader } from "../loaders";
import AnalyticsEmptyState from "../empty-state";
import { exportCSV } from "../export";
import { generateBarColor } from "./utils";
export default function PriorityChart({
  scope,
  generation,
  axis,
  groupBy,
  workspaceSlug,
}: {
  scope: AnalyticsScope;
  generation: number;
  axis: FunctionArgs<typeof api.reporting.analytics.chart>["axis"];
  groupBy: FunctionArgs<typeof api.reporting.analytics.chart>["groupBy"];
  workspaceSlug: string;
}) {
  const { resolvedTheme } = useTheme();
  const read = useCallback(
    async (client: ConvexReactClient, signal: AbortSignal) => {
      const pages = await readReportPages(
        (cursor) =>
          client.query(api.reporting.analytics.chart, {
            scope,
            axis,
            groupBy,
            paginationOpts: { cursor, numItems: 100 },
          }),
        signal,
        () => {}
      );
      const pairs = new Map<string, (typeof pages)[number][number]>();
      for (const page of pages)
        for (const row of page) {
          const key = JSON.stringify([row.x.key, row.x.name, row.group?.key ?? null, row.group?.name ?? null]);
          const previous = pairs.get(key);
          pairs.set(key, { ...row, count: row.count + (previous?.count ?? 0) });
        }
      const groups = new Map<string, { name: string; color: string | null }>();
      const rows = new Map<
        string,
        { key: string; name: string; count: number; color: string | null; values: Record<string, number> }
      >();
      for (const pair of pairs.values()) {
        const key = JSON.stringify([pair.x.key, pair.x.name]);
        const row = rows.get(key) ?? { key: pair.x.key, name: pair.x.name, count: 0, color: pair.x.color, values: {} };
        row.count += pair.count;
        if (pair.group) {
          const group = JSON.stringify([pair.group.key, pair.group.name]);
          groups.set(group, { name: pair.group.name, color: pair.group.color });
          row.values[group] = (row.values[group] ?? 0) + pair.count;
        }
        rows.set(key, row);
      }
      return { rows: [...rows.values()], groups: [...groups] };
    },
    [scope, axis, groupBy]
  );
  const report = useAnalyticsReport(read, generation);
  const colors = generateExtendedColors(
    CHART_COLOR_PALETTES[0][resolvedTheme === "dark" ? "dark" : "light"],
    report.data?.groups.length ?? 0
  );
  const bars: TBarItem<string>[] = groupBy
    ? (report.data?.groups.map(([key, group], index) => ({
        key,
        label: group.name,
        fill: group.color ?? colors[index],
        stackId: "bar-one",
        textClassName: "",
      })) ?? [])
    : [
        {
          key: "count",
          label: "Count",
          fill: (payload) => generateBarColor(payload.key, axis, payload.color),
          stackId: "bar-one",
          textClassName: "",
        },
      ];
  const chartData = report.data?.rows.map((row) => ({
    key: row.key,
    name: row.name,
    count: row.count,
    color: generateBarColor(row.key, axis, row.color),
    ...row.values,
  }));
  const columns = useMemo<ColumnDef<NonNullable<typeof report.data>["rows"][number]>[]>(
    () => [
      {
        id: "name",
        accessorKey: "name",
        header: analyticsAxes[axis],
        meta: { export: { key: analyticsAxes[axis], value: (row) => row.original.name } },
      },
      {
        id: "count",
        accessorKey: "count",
        header: "Count",
        meta: { export: { key: "Count", value: (row) => row.original.count } },
      },
      ...(report.data?.groups.map(([key, group]) => ({
        id: key,
        accessorFn: (row: NonNullable<typeof report.data>["rows"][number]) => row.values[key] ?? 0,
        header: group.name,
        meta: {
          export: {
            key: group.name,
            value: (row: import("@tanstack/react-table").Row<NonNullable<typeof report.data>["rows"][number]>) =>
              row.original.values[key] ?? 0,
          },
        },
      })) ?? []),
    ],
    [report.data, axis]
  );
  return (
    <div className="flex flex-col gap-12">
      <AnalyticsError error={report.error} />
      {report.isLoading ? (
        <ChartLoader />
      ) : report.data && report.data.rows.length > 0 ? (
        <>
          <BarChart
            className="h-[370px] w-full"
            data={chartData ?? []}
            bars={bars}
            margin={{ bottom: 30 }}
            xAxis={{ key: "name", label: analyticsAxes[axis], dy: 30 }}
            yAxis={{ key: "count", label: "Number of work items", offset: -60, dx: -26 }}
          />
          <DataTable
            columns={columns}
            data={report.data.rows}
            searchPlaceholder={`${report.data.rows.length} ${analyticsAxes[axis]}`}
            actions={(table) => (
              <Button
                variant="secondary"
                prependIcon={<Download className="size-3.5" />}
                onClick={() => exportCSV(table.getFilteredRowModel().rows, columns, workspaceSlug)}
              >
                CSV
              </Button>
            )}
          />
        </>
      ) : (
        !report.error && <AnalyticsEmptyState title="No work items to display" />
      )}
    </div>
  );
}
