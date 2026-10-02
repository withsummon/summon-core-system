/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useTranslation } from "@plane/i18n";
import { PieChart } from "@plane/propel/charts/pie-chart";
import { EmptyStateCompact } from "@plane/propel/empty-state";
import { Card } from "@plane/ui";
import type { ProfileSummary } from "./stats";
import { profileStateDistribution, profileStatusAppearance } from "./workload";

export function ProfileStateDistribution({ summary }: { summary: ProfileSummary }) {
  const { t } = useTranslation();
  if (summary.status !== "Exhausted") return null;
  const distribution = profileStateDistribution(summary.results);
  const data = distribution.map((group) => ({
    key: group.status,
    value: group.count,
    name: profileStatusAppearance[group.status].label,
    color: profileStatusAppearance[group.status].color,
  }));

  return (
    <div className="flex flex-col space-y-2">
      <h3 className="text-16 font-medium">{t("profile.stats.state_distribution.title")}</h3>
      <Card className="h-full">
        {distribution.some((group) => group.count > 0) ? (
          <div className="grid h-[300px] w-full grid-cols-1 gap-x-6 md:grid-cols-2">
            <div role="img" aria-label={data.map((item) => `${item.name}: ${item.value}`).join(", ")}>
              <PieChart
                className="size-full"
                dataKey="value"
                margin={{ top: 0, right: -10, bottom: 12, left: -10 }}
                data={data}
                cells={data.map((group) => ({ key: group.key, fill: group.color }))}
                showTooltip
                tooltipLabel="Count"
                paddingAngle={5}
                cornerRadius={4}
                innerRadius="50%"
                showLabel={false}
              />
            </div>
            <div className="flex items-center">
              <div className="w-full space-y-4">
                {distribution.map((group) => (
                  <div key={group.status} className="flex items-center justify-between gap-2 text-11">
                    <div className="flex items-center gap-1.5">
                      <div
                        className="h-2.5 w-2.5 rounded-xs"
                        style={{ backgroundColor: profileStatusAppearance[group.status].color }}
                      />
                      <div className="whitespace-nowrap">{profileStatusAppearance[group.status].label}</div>
                    </div>
                    <div>{group.count}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <EmptyStateCompact
            assetKey="priority"
            assetClassName="size-20"
            title={t("profile.stats.state_distribution.empty")}
          />
        )}
      </Card>
    </div>
  );
}
