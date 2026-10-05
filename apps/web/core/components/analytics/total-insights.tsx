/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useTranslation } from "@plane/i18n";
import { cn } from "@plane/utils";
import type { TaskCounts } from "./analytics-wrapper";
import InsightCard from "./insight-card";
export const statusLabels = {
  backlog: "Backlog",
  todo: "Unstarted",
  in_progress: "Started",
  done: "Completed",
  cancelled: "Cancelled",
} satisfies Record<Exclude<keyof TaskCounts, "total">, string>;
export default function TotalInsights({
  counts,
  overview,
  isLoading,
  peekView,
}: {
  counts?: TaskCounts;
  overview?: {
    projects: number;
    cycles: number;
    intake: number;
    people: { total: number; admin: number; member: number; guest: number };
  };
  isLoading: boolean;
  peekView?: boolean;
}) {
  const { t } = useTranslation();
  const cards = overview
    ? [
        { label: t("workspace_analytics.total", { entity: t("common.users") }), count: overview.people.total },
        { label: t("workspace_analytics.total", { entity: t("common.admins") }), count: overview.people.admin },
        { label: t("workspace_analytics.total", { entity: t("common.members") }), count: overview.people.member },
        { label: t("workspace_analytics.total", { entity: t("common.guests") }), count: overview.people.guest },
        { label: t("workspace_analytics.total", { entity: t("common.projects") }), count: overview.projects },
        { label: t("workspace_analytics.total", { entity: t("common.work_items") }), count: counts?.total },
        { label: t("workspace_analytics.total", { entity: t("common.cycles") }), count: overview.cycles },
        { label: t("workspace_analytics.total", { entity: t("sidebar.intake") }), count: overview.intake },
      ]
    : [
        { label: t("workspace_analytics.total", { entity: t("common.work_items") }), count: counts?.total },
        {
          label: t("workspace_analytics.started_work_items", { entity: t("common.work_items") }),
          count: counts?.in_progress,
        },
        {
          label: t("workspace_analytics.backlog_work_items", { entity: t("common.work_items") }),
          count: counts?.backlog,
        },
        {
          label: t("workspace_analytics.un_started_work_items", { entity: t("common.work_items") }),
          count: counts?.todo,
        },
        {
          label: t("workspace_analytics.completed_work_items", { entity: t("common.work_items") }),
          count: counts?.done,
        },
      ];
  return (
    <div
      className={cn(
        "grid grid-cols-1 gap-8 sm:grid-cols-2 md:gap-10",
        peekView ? "grid-cols-2" : overview ? "lg:grid-cols-4" : "lg:grid-cols-5"
      )}
    >
      {cards.map((card) => (
        <InsightCard key={card.label} {...card} isLoading={isLoading} />
      ))}
    </div>
  );
}
