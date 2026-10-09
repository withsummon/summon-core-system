/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { STATE_GROUPS } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
import { Card, ECardDirection, ECardSpacing, Loader } from "@plane/ui";
import { statusOptions } from "@/components/convex-core/tasks/options";
import type { ProfileSummary } from "./stats";

export const profileStatusAppearance = {
  backlog: {
    label: STATE_GROUPS.backlog.label,
    workloadLabel: STATE_GROUPS.backlog.label,
    color: STATE_GROUPS.backlog.color,
  },
  todo: { label: STATE_GROUPS.unstarted.label, workloadLabel: "Not started", color: STATE_GROUPS.unstarted.color },
  in_progress: { label: STATE_GROUPS.started.label, workloadLabel: "Working on", color: STATE_GROUPS.started.color },
  done: {
    label: STATE_GROUPS.completed.label,
    workloadLabel: STATE_GROUPS.completed.label,
    color: STATE_GROUPS.completed.color,
  },
  cancelled: {
    label: STATE_GROUPS.cancelled.label,
    workloadLabel: STATE_GROUPS.cancelled.label,
    color: STATE_GROUPS.cancelled.color,
  },
} satisfies Record<
  ProfileSummary["results"][number]["statusDistribution"][number]["status"],
  { label: string; workloadLabel: string; color: string }
>;

export function profileStateDistribution(projects: ProfileSummary["results"]) {
  return statusOptions.map(({ value: status }) => ({
    status,
    count: projects.reduce(
      (total, project) =>
        total +
        project.statusDistribution.reduce((count, item) => count + (item.status === status ? item.count : 0), 0),
      0
    ),
  }));
}

export function ProfileWorkload({ summary }: { summary: ProfileSummary }) {
  const { t } = useTranslation();
  return (
    <div className="space-y-2">
      <h3 className="text-16 font-medium">{t("profile.stats.workload")}</h3>
      {summary.status === "Exhausted" ? (
        <div className="grid grid-cols-1 justify-stretch gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {profileStateDistribution(summary.results).map((group) => (
            <Card key={group.status} direction={ECardDirection.ROW} spacing={ECardSpacing.SM}>
              <div
                className="my-2 h-3 w-3 rounded-xs"
                style={{ backgroundColor: profileStatusAppearance[group.status].color }}
              />
              <div className="flex-col space-y-1">
                <span className="text-13 text-placeholder">{profileStatusAppearance[group.status].workloadLabel}</span>
                <p className="text-18 font-semibold">{group.count}</p>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Loader className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          <span className="sr-only">{t("loading")}</span>
          {statusOptions.map((status) => (
            <Loader.Item key={status.value} height="80px" />
          ))}
        </Loader>
      )}
    </div>
  );
}
