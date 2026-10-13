/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { MutableRefObject } from "react";
import { useCallback } from "react";
import { observer } from "mobx-react";
// plane constants
import { DRAG_ALLOWED_GROUPS } from "@plane/constants";
//types
import type {
  IState,
  TGroupedIssues,
  TIssue,
  IIssueDisplayProperties,
  IIssueMap,
  TSubGroupedIssues,
  TIssueGroupByOptions,
  TIssueOrderByOptions,
} from "@plane/types";
import { EIssueLayoutTypes } from "@plane/types";
import { cn } from "@plane/utils";
import type { GroupDropLocation } from "@/components/issues/issue-layouts/utils";
// components
import { useWorkFlowFDragNDrop } from "@/components/workflow";
// hooks
import { useProjectState } from "@/hooks/store/use-project-state";
import { useIssuesStore } from "@/hooks/use-issue-layout-store";
// local imports
import { GroupDragOverlay } from "../group-drag-overlay";
import type { TRenderQuickActions } from "../list/list-view-types";
import { KanbanQuickAddIssueButton, QuickAddIssueRoot } from "../quick-add";
import { KanbanIssueBlocksList } from "./blocks-list";
import { KanbanGroupLoadMore } from "./kanban-group-load-more";
import { useKanbanGroupDropTarget } from "./use-kanban-group-drop-target";

interface IKanbanGroup {
  groupId: string;
  issuesMap: IIssueMap;
  groupedIssueIds: TGroupedIssues | TSubGroupedIssues;
  displayProperties: IIssueDisplayProperties | undefined;
  sub_group_by: TIssueGroupByOptions | undefined;
  group_by: TIssueGroupByOptions | undefined;
  sub_group_id: string;
  isDragDisabled: boolean;
  isDropDisabled: boolean;
  dropErrorMessage: string | undefined;
  updateIssue: ((projectId: string | null, issueId: string, data: Partial<TIssue>) => Promise<void>) | undefined;
  quickActions: TRenderQuickActions;
  enableQuickIssueCreate?: boolean;
  quickAddCallback?: (projectId: string | null | undefined, data: TIssue) => Promise<TIssue | undefined>;
  loadMoreIssues: (groupId?: string, subGroupId?: string) => void;
  disableIssueCreation?: boolean;
  canEditProperties: (projectId: string | undefined) => boolean;
  groupByVisibilityToggle?: boolean;
  scrollableContainerRef?: MutableRefObject<HTMLDivElement | null>;
  handleOnDrop: (source: GroupDropLocation, destination: GroupDropLocation) => Promise<void>;
  orderBy: TIssueOrderByOptions | undefined;
  isEpic?: boolean;
}

const getGroupPrePopulatedData = (key: string, value: string): object => {
  switch (key) {
    case "state":
      return { state_id: value };
    case "priority":
      return { priority: value };
    case "cycle":
      return { cycle_id: value };
    case "module":
      return { module_ids: [value] };
    case "labels":
      return value != "None" ? { label_ids: [value] } : { [key]: value };
    case "assignees":
      return value != "None" ? { assignee_ids: [value] } : { [key]: value };
    case "created_by":
      return {};
    default:
      return { [key]: value };
  }
};

const prePopulateQuickAddData = (
  projectStates: IState[] | undefined,
  groupByKey: string,
  subGroupByKey: string | undefined | null,
  groupValue: string,
  subGroupValue: string
) => {
  const defaultState = projectStates?.find((state) => state.default);
  return {
    state_id: defaultState?.id,
    ...getGroupPrePopulatedData(groupByKey, groupValue),
    ...(subGroupByKey ? getGroupPrePopulatedData(subGroupByKey, subGroupValue) : {}),
  };
};

const getGroupIssueIds = (
  groupedIssueIds: TGroupedIssues | TSubGroupedIssues,
  groupId: string,
  subGroupId: string,
  isSubGroup: boolean
): string[] =>
  (isSubGroup
    ? (groupedIssueIds as TSubGroupedIssues)?.[groupId]?.[subGroupId]
    : (groupedIssueIds as TGroupedIssues)?.[groupId]) ?? [];

const getShouldLoadMore = (nextPageResults: boolean | undefined, issueCount: number, groupIssueCount: number) =>
  nextPageResults === undefined ? issueCount < groupIssueCount : nextPageResults;

const getCanDragIssuesInGrouping = (
  groupBy: TIssueGroupByOptions | undefined,
  subGroupBy: TIssueGroupByOptions | undefined
) => !!groupBy && DRAG_ALLOWED_GROUPS.includes(groupBy) && (!subGroupBy || DRAG_ALLOWED_GROUPS.includes(subGroupBy));

export const KanbanGroup = observer(function KanbanGroup(props: IKanbanGroup) {
  const {
    groupId,
    sub_group_id,
    group_by,
    orderBy,
    sub_group_by,
    issuesMap,
    displayProperties,
    groupedIssueIds,
    isDropDisabled,
    dropErrorMessage,
    updateIssue,
    quickActions,
    canEditProperties,
    loadMoreIssues,
    enableQuickIssueCreate,
    disableIssueCreation,
    quickAddCallback,
    scrollableContainerRef,
    handleOnDrop,
    isEpic = false,
  } = props;
  // hooks
  const projectState = useProjectState();

  const {
    issues: { getGroupIssueCount, getPaginationData },
  } = useIssuesStore();

  const loadMoreIssuesInThisGroup = useCallback(() => {
    loadMoreIssues(groupId, sub_group_id === "null" ? undefined : sub_group_id);
  }, [loadMoreIssues, groupId, sub_group_id]);

  const { workflowDisabledSource, isWorkflowDropDisabled, handleWorkFlowState, getIsWorkflowWorkItemCreationDisabled } =
    useWorkFlowFDragNDrop(group_by, sub_group_by);

  const isColumnDropDisabled = isWorkflowDropDisabled || isDropDisabled;

  // Enable Kanban Columns as Drop Targets
  const { columnRef, isDraggingOverColumn } = useKanbanGroupDropTarget({
    groupId,
    subGroupId: sub_group_id,
    orderBy,
    isDropDisabled: isColumnDropDisabled,
    dropErrorMessage,
    handleWorkFlowState,
    handleOnDrop,
  });

  const containerRef = sub_group_by && scrollableContainerRef ? scrollableContainerRef : columnRef;

  const isSubGroup = !!sub_group_id && sub_group_id !== "null";
  const issueIds = getGroupIssueIds(groupedIssueIds, groupId, sub_group_id, isSubGroup);
  const groupIssueCount = getGroupIssueCount(groupId, sub_group_id, false) ?? 0;
  const nextPageResults = getPaginationData(groupId, sub_group_id)?.nextPageResults;

  const shouldLoadMore = getShouldLoadMore(nextPageResults, issueIds.length, groupIssueCount);
  const canOverlayBeVisible = isColumnDropDisabled || orderBy !== "sort_order";
  const shouldOverlayBeVisible = isDraggingOverColumn && canOverlayBeVisible;
  const canDragIssuesInCurrentGrouping = getCanDragIssuesInGrouping(group_by, sub_group_by);
  const showQuickAdd =
    enableQuickIssueCreate && !disableIssueCreation && !getIsWorkflowWorkItemCreationDisabled(groupId, sub_group_id);

  return (
    <div
      id={`${groupId}__${sub_group_id}`}
      className={cn(
        "relative h-full min-h-[120px] transition-colors",
        { "rounded-sm bg-layer-1": isDraggingOverColumn },
        { "vertical-scrollbar scrollbar-md": !sub_group_by && !shouldOverlayBeVisible }
      )}
      ref={columnRef}
    >
      <GroupDragOverlay
        dragColumnOrientation={sub_group_by ? "justify-start" : "justify-center"}
        canOverlayBeVisible={canOverlayBeVisible}
        isDropDisabled={isColumnDropDisabled}
        workflowDisabledSource={workflowDisabledSource}
        dropErrorMessage={dropErrorMessage}
        orderBy={orderBy}
        isDraggingOverColumn={isDraggingOverColumn}
        isEpic={isEpic}
      />
      <KanbanIssueBlocksList
        sub_group_id={sub_group_id}
        groupId={groupId}
        issuesMap={issuesMap}
        issueIds={issueIds}
        displayProperties={displayProperties}
        updateIssue={updateIssue}
        quickActions={quickActions}
        canEditProperties={canEditProperties}
        scrollableContainerRef={scrollableContainerRef}
        canDropOverIssue={!canOverlayBeVisible}
        canDragIssuesInCurrentGrouping={canDragIssuesInCurrentGrouping}
        isEpic={isEpic}
      />

      {shouldLoadMore && (
        <KanbanGroupLoadMore
          groupId={groupId}
          subGroupId={sub_group_id}
          isSubGroup={isSubGroup}
          containerRef={containerRef}
          onLoadMore={loadMoreIssuesInThisGroup}
        />
      )}

      {showQuickAdd && (
        <div className="sticky bottom-0 w-full bg-surface-2 py-0.5">
          <QuickAddIssueRoot
            layout={EIssueLayoutTypes.KANBAN}
            QuickAddButton={KanbanQuickAddIssueButton}
            prePopulatedData={
              group_by
                ? prePopulateQuickAddData(projectState.projectStates, group_by, sub_group_by, groupId, sub_group_id)
                : {}
            }
            quickAddCallback={quickAddCallback}
            isEpic={isEpic}
          />
        </div>
      )}
    </div>
  );
});
