/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { ISSUE_PRIORITIES } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
import { BarChart } from "@plane/propel/charts/bar-chart";
import { EmptyStateCompact } from "@plane/propel/empty-state";
import { Loader, Card } from "@plane/ui";
import { capitalizeFirstLetter } from "@plane/utils";
import type { ProfileSummary } from "./stats";

const priorityColors = {
  urgent: "#991b1b",
  high: "#ef4444",
  medium: "#f59e0b",
  low: "#16a34a",
  none: "#e5e5e5",
} satisfies Record<ProfileSummary["results"][number]["priorityDistribution"][number]["priority"], string>;

export function ProfilePriorityDistribution({ summary }: { summary: ProfileSummary }) {
  const { t } = useTranslation();
  const data = ISSUE_PRIORITIES.map(({ key: priority }) => ({
    key: priority,
    name: capitalizeFirstLetter(priority),
    count: summary.results.reduce(
      (total, project) =>
        total +
        project.priorityDistribution.reduce((count, item) => count + (item.priority === priority ? item.count : 0), 0),
      0
    ),
    color: priorityColors[priority],
  }));
  return (
    <div className="flex flex-col space-y-2">
      <h3 className="text-16 font-medium">{t("profile.stats.priority_distribution.title")}</h3>
      {summary.status === "Exhausted" ? (
        <Card role="img" aria-label={data.map((item) => `${item.name}: ${item.count}`).join(", ")}>
          {data.some((item) => item.count > 0) ? (
            <BarChart
              className="h-[300px] w-full"
              margin={{ top: 20, right: 30, bottom: 5, left: 0 }}
              data={data}
              bars={[
                {
                  key: "count",
                  label: "Count",
                  stackId: "bar-one",
                  fill: (payload: (typeof data)[number]) => payload.color,
                  textClassName: "",
                  showPercentage: false,
                  showTopBorderRadius: () => true,
                  showBottomBorderRadius: () => true,
                },
              ]}
              xAxis={{ key: "name", label: t("common.priority") }}
              yAxis={{ key: "count", label: "" }}
              barSize={20}
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
            <span className="sr-only">{t("loading")}</span>
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
