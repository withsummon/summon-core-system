/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

// plane imports
import { useTranslation } from "@plane/i18n";
import { Bar, BarChart, BarXAxis, ChartTooltip, Grid, YAxis } from "@plane/propel/charts/bar-chart";
import { EmptyStateCompact } from "@plane/propel/empty-state";
import type { IUserProfileData } from "@plane/types";
import { Loader, Card } from "@plane/ui";
import { capitalizeFirstLetter } from "@plane/utils";
// components
import { toCategorySeries } from "@/components/chart/utils";

type Props = {
  userProfile: IUserProfileData | undefined;
};

const priorityColors = {
  urgent: "var(--priority-urgent)",
  high: "var(--priority-high)",
  medium: "var(--priority-medium)",
  low: "var(--priority-low)",
  none: "var(--priority-none)",
};

export function ProfilePriorityDistribution({ userProfile }: Props) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col space-y-2">
      <h3 className="text-16 font-medium">{t("profile.stats.priority_distribution.title")}</h3>
      {userProfile ? (
        <Card>
          {userProfile.priority_distribution.length > 0 ? (
            <PriorityBars
              rows={userProfile.priority_distribution.map((priority) => ({
                key: priority.priority ?? "none",
                name: capitalizeFirstLetter(priority.priority ?? "None"),
                count: priority.priority_count,
              }))}
            />
          ) : (
            <EmptyStateCompact
              assetKey="priority"
              assetClassName="size-20"
              title={t("workspace_empty_state.your_work_by_priority.title")}
            />
          )}
        </Card>
      ) : (
        <div className="grid place-items-center p-7">
          <Loader className="flex items-end gap-12">
            <Loader.Item width="30px" height="200px" />
            <Loader.Item width="30px" height="150px" />
            <Loader.Item width="30px" height="250px" />
            <Loader.Item width="30px" height="150px" />
            <Loader.Item width="30px" height="100px" />
          </Loader>
        </div>
      )}
    </div>
  );
}

function PriorityBars({ rows }: { rows: Array<{ key: string; name: string; count: number }> }) {
  const { data, series } = toCategorySeries(rows, {
    valueOf: (row) => row.count,
    colorOf: (row) => priorityColors[row.key as keyof typeof priorityColors] ?? priorityColors.none,
  });
  return (
    <BarChart data={data} xDataKey="name" stacked barGap={0.55} className="w-full" margin={{ left: 40, right: 16 }}>
      <Grid horizontal strokeDasharray="3 4" />
      {series.map((entry) => (
        <Bar key={entry.key} dataKey={entry.key} fill={entry.color} lineCap={4} />
      ))}
      <BarXAxis />
      <YAxis />
      <ChartTooltip
        showCrosshair={false}
        rows={(point) => [{ color: String(point.color), label: "Count", value: String(point.count) }]}
      />
    </BarChart>
  );
}
