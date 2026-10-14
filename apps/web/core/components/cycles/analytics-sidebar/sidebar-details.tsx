/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import React from "react";
import { isEmpty } from "lodash-es";
import { observer } from "mobx-react";
import { SquareUser } from "lucide-react";
// plane types
import { EEstimateSystem } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
import { MembersPropertyIcon, WorkItemsIcon } from "@plane/propel/icons";
import type { ICycle, TProgressSnapshot } from "@plane/types";
// plane ui
import { Avatar, AvatarGroup, TextArea } from "@plane/ui";
// helpers
import { getFileURL } from "@plane/utils";
// hooks
import { useProjectEstimates } from "@/hooks/store/estimates";
import { useMember } from "@/hooks/store/use-member";
// plane web constants

type Props = {
  projectId: string;
  cycleDetails: ICycle;
};

function getCycleProgressLabels(cycleDetails: ICycle, emptyCountLabel: string) {
  const isCompleted = cycleDetails?.status?.toLocaleLowerCase() === "completed";
  // completed cycles report their frozen snapshot when one exists
  const progressSource: TProgressSnapshot | ICycle | undefined =
    isCompleted && !isEmpty(cycleDetails?.progress_snapshot) ? cycleDetails?.progress_snapshot : cycleDetails;
  const hasNoIssues = progressSource?.total_issues === 0;

  return {
    isCompleted,
    issueCount: hasNoIssues ? emptyCountLabel : `${progressSource?.completed_issues}/${progressSource?.total_issues}`,
    issueEstimatePointCount: hasNoIssues
      ? emptyCountLabel
      : `${progressSource?.completed_estimate_points}/${progressSource?.total_estimate_points}`,
  };
}

function hasPointEstimates(cycleDetails: ICycle, isPointsEstimateSystem: boolean) {
  if (isEmpty(cycleDetails?.progress_snapshot || {})) return isPointsEstimateSystem;
  return !isEmpty(cycleDetails?.progress_snapshot?.estimate_distribution || {});
}

const CycleMembers = observer(function CycleMembers({ assigneeIds }: { assigneeIds: string[] | undefined }) {
  const { getUserDetails } = useMember();
  const { t } = useTranslation();

  if (!assigneeIds || assigneeIds.length === 0)
    return <span className="px-1.5 text-13 text-tertiary">{t("no_assignee")}</span>;

  return (
    <AvatarGroup showTooltip>
      {assigneeIds.map((member) => {
        const memberDetails = getUserDetails(member);
        return (
          <Avatar
            key={memberDetails?.id}
            name={memberDetails?.display_name ?? ""}
            src={getFileURL(memberDetails?.avatar_url ?? "")}
            showTooltip={false}
          />
        );
      })}
    </AvatarGroup>
  );
});

export const CycleSidebarDetails = observer(function CycleSidebarDetails(props: Props) {
  const { projectId, cycleDetails } = props;
  // hooks
  const { getUserDetails } = useMember();
  const { areEstimateEnabledByProjectId, currentActiveEstimateId, estimateById } = useProjectEstimates();
  const { t } = useTranslation();

  const areEstimateEnabled = projectId && areEstimateEnabledByProjectId(projectId.toString());
  const estimateType = areEstimateEnabled && currentActiveEstimateId && estimateById(currentActiveEstimateId);
  const cycleOwnerDetails = cycleDetails ? getUserDetails(cycleDetails.owned_by_id) : undefined;
  const { isCompleted, issueCount, issueEstimatePointCount } = getCycleProgressLabels(
    cycleDetails,
    `0 ${t("common.work_item")}`
  );
  const isEstimatePointValid = hasPointEstimates(
    cycleDetails,
    !!estimateType && estimateType?.type == EEstimateSystem.POINTS
  );

  return (
    <div className="flex w-full flex-col gap-5">
      {cycleDetails?.description && (
        <TextArea
          className="ring-none !m-0 max-h-max w-full resize-none !border-0 bg-transparent !p-0 text-13 leading-5 text-secondary outline-none"
          value={cycleDetails.description}
          disabled
        />
      )}

      <div className="flex flex-col gap-5 pt-2.5 pb-6">
        <div className="flex items-center justify-start gap-1">
          <div className="flex w-2/5 items-center justify-start gap-2 text-tertiary">
            <SquareUser className="h-4 w-4" />
            <span className="text-14">{t("lead")}</span>
          </div>
          <div className="flex w-3/5 items-center rounded-xs">
            <div className="flex items-center gap-2.5">
              <Avatar name={cycleOwnerDetails?.display_name} src={getFileURL(cycleOwnerDetails?.avatar_url ?? "")} />
              <span className="text-13 text-secondary">{cycleOwnerDetails?.display_name}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-start gap-1">
          <div className="flex w-2/5 items-center justify-start gap-2 text-tertiary">
            <MembersPropertyIcon className="h-4 w-4" />
            <span className="text-14">{t("members")}</span>
          </div>
          <div className="flex w-3/5 items-center rounded-xs">
            <div className="flex items-center gap-2.5">
              <CycleMembers assigneeIds={cycleDetails?.assignee_ids} />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-start gap-1">
          <div className="flex w-2/5 items-center justify-start gap-2 text-tertiary">
            <WorkItemsIcon className="h-4 w-4" />
            <span className="text-14">{t("work_items")}</span>
          </div>
          <div className="flex w-3/5 items-center">
            <span className="px-1.5 text-13 text-tertiary tabular-nums">{issueCount}</span>
          </div>
        </div>

        {/**
         * NOTE: Render this section when estimate points of he projects is enabled and the estimate system is points
         */}
        {isEstimatePointValid && !isCompleted && (
          <div className="flex items-center justify-start gap-1">
            <div className="flex w-2/5 items-center justify-start gap-2 text-tertiary">
              <WorkItemsIcon className="h-4 w-4" />
              <span className="text-14">{t("points")}</span>
            </div>
            <div className="flex w-3/5 items-center">
              <span className="px-1.5 text-13 text-tertiary tabular-nums">{issueEstimatePointCount}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
});
