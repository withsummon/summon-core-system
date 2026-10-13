/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

// plane imports
import { STATE_GROUPS } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
import { PieCenter, PieChart, PieSlice } from "@plane/propel/charts/pie-chart";
import { EmptyStateCompact } from "@plane/propel/empty-state";
import type { IUserProfileData, IUserStateDistribution } from "@plane/types";
import { Card } from "@plane/ui";
import { capitalizeFirstLetter } from "@plane/utils";

type Props = {
  stateDistribution: IUserStateDistribution[];
  userProfile: IUserProfileData | undefined;
};

export function ProfileStateDistribution({ stateDistribution, userProfile }: Props) {
  const { t } = useTranslation();
  if (!userProfile) return null;

  return (
    <div className="flex flex-col space-y-2">
      <h3 className="text-16 font-medium">{t("profile.stats.state_distribution.title")}</h3>
      <Card className="h-full">
        {userProfile.state_distribution.length > 0 ? (
          <div className="grid h-[300px] w-full grid-cols-1 gap-x-6 md:grid-cols-2">
            <div className="mx-auto aspect-square h-full max-h-[300px]">
              <PieChart
                data={userProfile.state_distribution.map((group) => ({
                  label: capitalizeFirstLetter(group.state_group),
                  value: group.state_count,
                  color: STATE_GROUPS[group.state_group]?.color,
                }))}
                innerRadius={72}
                padAngle={0.03}
                cornerRadius={4}
              >
                {userProfile.state_distribution.map((group, index) => (
                  <PieSlice key={group.state_group} index={index} hoverEffect="grow" hoverOffset={4} />
                ))}
                <PieCenter defaultLabel="Work items" />
              </PieChart>
            </div>
            <div className="flex items-center">
              <div className="w-full space-y-4">
                {stateDistribution.map((group) => (
                  <div key={group.state_group} className="flex items-center justify-between gap-2 text-11">
                    <div className="flex items-center gap-1.5">
                      <div
                        className="h-2.5 w-2.5 rounded-xs"
                        style={{
                          backgroundColor:
                            STATE_GROUPS[group.state_group]?.color ?? "var(--background-color-accent-primary)",
                        }}
                      />
                      <div className="whitespace-nowrap">{STATE_GROUPS[group.state_group].label}</div>
                    </div>
                    <div>{group.state_count}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <EmptyStateCompact
            assetKey="priority"
            assetClassName="size-20"
            title={t("workspace_empty_state.your_work_by_priority.title")}
          />
        )}
      </Card>
    </div>
  );
}
