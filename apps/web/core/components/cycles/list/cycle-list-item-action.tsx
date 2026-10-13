/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import React, { useEffect, useMemo } from "react";
import { observer } from "mobx-react";
import { useForm } from "react-hook-form";
// plane imports
import { EUserPermissions, EUserPermissionsLevel } from "@plane/constants";
import { WorkItemsIcon } from "@plane/propel/icons";
import type { ICycle, TCycleGroups } from "@plane/types";
import { FavoriteStar } from "@plane/ui";
// components
import { ButtonAvatars } from "@/components/dropdowns/member/avatar";
// hooks
import { useMember } from "@/hooks/store/use-member";
import { useUserPermissions } from "@/hooks/store/user";
import { usePlatformOS } from "@/hooks/use-platform-os";
// local imports
import { CycleQuickActions } from "../quick-actions";
import {
  ActiveCycleDuration,
  CycleDateRange,
  CycleMembers,
  CycleOverviewButton,
  CycleTransferIssuesButton,
} from "./cycle-list-item-details";
import { useCycleFavoriteActions } from "./use-cycle-favorite-actions";

type Props = {
  workspaceSlug: string;
  projectId: string;
  cycleId: string;
  cycleDetails: ICycle;
  parentRef: React.RefObject<HTMLDivElement>;
  isActive?: boolean;
};

const defaultValues: Partial<ICycle> = {
  start_date: null,
  end_date: null,
};

export const CycleListItemAction = observer(function CycleListItemAction(props: Props) {
  const { workspaceSlug, projectId, cycleId, cycleDetails, parentRef, isActive = false } = props;
  // hooks
  const { isMobile } = usePlatformOS();
  // store hooks
  const { allowPermissions } = useUserPermissions();
  const { handleAddToFavorites, handleRemoveFromFavorites } = useCycleFavoriteActions(
    workspaceSlug,
    projectId,
    cycleId
  );

  const { getUserDetails } = useMember();

  // form
  const { reset } = useForm({
    defaultValues,
  });

  // derived values
  const cycleStatus = cycleDetails.status ? (cycleDetails.status.toLocaleLowerCase() as TCycleGroups) : "draft";

  const showIssueCount = useMemo(() => cycleStatus === "draft" || cycleStatus === "upcoming", [cycleStatus]);

  const isEditingAllowed = allowPermissions(
    [EUserPermissions.ADMIN, EUserPermissions.MEMBER],
    EUserPermissionsLevel.PROJECT,
    workspaceSlug,
    projectId
  );

  const createdByDetails = cycleDetails.created_by ? getUserDetails(cycleDetails.created_by) : undefined;

  useEffect(() => {
    if (cycleDetails)
      reset({
        ...cycleDetails,
      });
  }, [cycleDetails, reset]);

  return (
    <>
      <CycleOverviewButton cycleId={cycleId} isActive={isActive} isMobile={isMobile} />
      {showIssueCount && (
        <div className="flex items-center gap-1">
          <WorkItemsIcon className="h-4 w-4 text-tertiary" />
          <span className="text-11 text-tertiary tabular-nums">{cycleDetails.total_issues}</span>
        </div>
      )}
      <CycleTransferIssuesButton
        cycleId={cycleId}
        cycleDetails={cycleDetails}
        isCompleted={cycleStatus === "completed"}
      />
      {isActive ? (
        <ActiveCycleDuration projectId={projectId} cycleDetails={cycleDetails} createdById={createdByDetails?.id} />
      ) : (
        cycleDetails.start_date && <CycleDateRange projectId={projectId} cycleDetails={cycleDetails} />
      )}
      {/* created by */}
      {createdByDetails && !isActive && <ButtonAvatars showTooltip={false} userIds={createdByDetails?.id} />}
      {!isActive && <CycleMembers cycleDetails={cycleDetails} isMobile={isMobile} />}
      {isEditingAllowed && !cycleDetails.archived_at && (
        <FavoriteStar
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (cycleDetails.is_favorite) handleRemoveFromFavorites(e);
            else handleAddToFavorites(e);
          }}
          selected={!!cycleDetails.is_favorite}
        />
      )}
      <div className="hidden md:block">
        <CycleQuickActions
          parentRef={parentRef}
          cycleId={cycleId}
          projectId={projectId}
          workspaceSlug={workspaceSlug}
        />
      </div>
    </>
  );
});
