/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
// plane imports
import type { TWorkItemFilterCondition } from "@plane/shared-state";
import { EIssuesStoreType } from "@plane/types";
// constants
import { CYCLE_ISSUES_WITH_PARAMS } from "@plane/constants";
// hooks
import { useCycle } from "@/hooks/store/use-cycle";
import { useIssues } from "@/hooks/store/use-issues";
import { useWorkItemFilters } from "@/hooks/store/work-item-filters/use-work-item-filters";

interface IActiveCycleDetails {
  workspaceSlug: string;
  projectId: string;
  cycleId: string | null | undefined;
}

const useCyclesDetails = (props: IActiveCycleDetails) => {
  // props
  const { workspaceSlug, projectId, cycleId } = props;
  // router
  const router = useRouter();
  // store hooks
  const {
    issuesFilter: { updateFilterExpression },
    issues: { getActiveCycleById: getActiveCycleByIdFromIssue, fetchActiveCycleIssues },
  } = useIssues(EIssuesStoreType.CYCLE);
  const { updateFilterExpressionFromConditions } = useWorkItemFilters();

  const { fetchActiveCycleProgress, getCycleById, fetchActiveCycleAnalytics } = useCycle();
  // derived values
  const cycle = cycleId ? getCycleById(cycleId) : null;

  // fetch cycle details only once the workspace, project and cycle are all known
  const fetchCycleId = workspaceSlug && projectId ? cycle?.id : undefined;
  const shouldFetchDistribution = !!fetchCycleId && !cycle?.distribution;
  const shouldFetchEstimateDistribution = !!fetchCycleId && !cycle?.estimate_distribution;

  useSWR(
    fetchCycleId ? `PROJECT_ACTIVE_CYCLE_${projectId}_PROGRESS_${fetchCycleId}` : null,
    fetchCycleId ? () => fetchActiveCycleProgress(workspaceSlug, projectId, fetchCycleId) : null,
    { revalidateIfStale: false, revalidateOnFocus: false }
  );
  useSWR(
    shouldFetchDistribution ? `PROJECT_ACTIVE_CYCLE_${projectId}_DURATION_${fetchCycleId}` : null,
    shouldFetchDistribution ? () => fetchActiveCycleAnalytics(workspaceSlug, projectId, fetchCycleId, "issues") : null
  );
  useSWR(
    shouldFetchEstimateDistribution ? `PROJECT_ACTIVE_CYCLE_${projectId}_ESTIMATE_DURATION_${fetchCycleId}` : null,
    shouldFetchEstimateDistribution
      ? () => fetchActiveCycleAnalytics(workspaceSlug, projectId, fetchCycleId, "points")
      : null
  );
  useSWR(
    fetchCycleId ? CYCLE_ISSUES_WITH_PARAMS(fetchCycleId, { priority: "urgent,high" }) : null,
    fetchCycleId ? () => fetchActiveCycleIssues(workspaceSlug, projectId, 30, fetchCycleId) : null,
    { revalidateIfStale: false, revalidateOnFocus: false }
  );

  const cycleIssueDetails = cycle?.id ? getActiveCycleByIdFromIssue(cycle?.id) : { nextPageResults: false };

  const handleFiltersUpdate = useCallback(
    async (conditions: TWorkItemFilterCondition[]) => {
      if (!workspaceSlug || !projectId || !cycleId) return;

      await updateFilterExpressionFromConditions(
        EIssuesStoreType.CYCLE,
        cycleId,
        conditions,
        updateFilterExpression.bind(updateFilterExpression, workspaceSlug, projectId, cycleId)
      );

      router.push(`/${workspaceSlug}/projects/${projectId}/cycles/${cycleId}`);
    },
    [workspaceSlug, projectId, cycleId, updateFilterExpressionFromConditions, updateFilterExpression, router]
  );
  return {
    cycle,
    cycleId,
    router,
    handleFiltersUpdate,
    cycleIssueDetails,
  };
};
export default useCyclesDetails;
