/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { MutableRefObject } from "react";
import { observer } from "mobx-react";
// plane imports
import { DRAG_ALLOWED_GROUPS } from "@plane/constants";
import type {
  IGroupByColumn,
  TIssueMap,
  TIssueGroupByOptions,
  TIssueOrderByOptions,
  TIssue,
  IIssueDisplayProperties,
  TIssueKanbanFilters,
  IState,
} from "@plane/types";
import { EIssueLayoutTypes } from "@plane/types";
import { Row } from "@plane/ui";
import { cn } from "@plane/utils";
// components
import { useWorkFlowFDragNDrop } from "@/components/workflow";
// hooks
import { useProjectState } from "@/hooks/store/use-project-state";
import { useIssuesStore } from "@/hooks/use-issue-layout-store";
import type { TSelectionHelper } from "@/hooks/use-multiple-select";
// local imports
import { GroupDragOverlay } from "../group-drag-overlay";
import { ListQuickAddIssueButton, QuickAddIssueRoot } from "../quick-add";
import type { GroupDropLocation } from "../utils";
import { IssueBlocksList } from "./blocks-list";
import { HeaderGroupByCard } from "./headers/group-by-card";
import { ListGroupLoadMore } from "./list-group-load-more";
import type { TRenderQuickActions } from "./list-view-types";
import { useListGroupDropTarget } from "./use-list-group-drop-target";

interface Props {
  groupIssueIds: string[] | undefined;
  group: IGroupByColumn;
  issuesMap: TIssueMap;
  group_by: TIssueGroupByOptions | null;
  orderBy: TIssueOrderByOptions | undefined;
  getGroupIndex: (groupId: string | undefined) => number;
  updateIssue: ((projectId: string | null, issueId: string, data: Partial<TIssue>) => Promise<void>) | undefined;
  quickActions: TRenderQuickActions;
  displayProperties: IIssueDisplayProperties | undefined;
  enableIssueQuickAdd: boolean;
  canEditProperties: (projectId: string | undefined) => boolean;
  containerRef: MutableRefObject<HTMLDivElement | null>;
  quickAddCallback?: ((projectId: string | null | undefined, data: TIssue) => Promise<TIssue | undefined>) | undefined;
  handleOnDrop: (source: GroupDropLocation, destination: GroupDropLocation) => Promise<void>;
  disableIssueCreation?: boolean;
  addIssuesToView?: (issueIds: string[]) => Promise<TIssue>;
  isCompletedCycle?: boolean;
  showEmptyGroup?: boolean;
  loadMoreIssues: (groupId?: string) => void;
  selectionHelpers: TSelectionHelper;
  handleCollapsedGroups: (value: string) => void;
  collapsedGroups: TIssueKanbanFilters;
  isEpic?: boolean;
}

const EMPTY_GROUP_ISSUE_IDS: string[] = [];

const getShouldLoadMore = (
  nextPageResults: boolean | undefined,
  groupIssueCount: number,
  groupIssueIds: string[] | undefined
) =>
  nextPageResults === undefined && groupIssueCount !== undefined && groupIssueIds
    ? groupIssueIds.length < groupIssueCount
    : !!nextPageResults;

const prePopulateQuickAddData = (projectStates: IState[] | undefined, groupByKey: string | null, value: any) => {
  const defaultState = projectStates?.find((state) => state.default);
  let preloadedData: object = { state_id: defaultState?.id };

  if (groupByKey === null) {
    preloadedData = { ...preloadedData };
  } else {
    if (groupByKey === "state") {
      preloadedData = { ...preloadedData, state_id: value };
    } else if (groupByKey === "priority") {
      preloadedData = { ...preloadedData, priority: value };
    } else if (groupByKey === "labels" && value != "None") {
      preloadedData = { ...preloadedData, label_ids: [value] };
    } else if (groupByKey === "assignees" && value != "None") {
      preloadedData = { ...preloadedData, assignee_ids: [value] };
    } else if (groupByKey === "cycle" && value != "None") {
      preloadedData = { ...preloadedData, cycle_id: value };
    } else if (groupByKey === "module" && value != "None") {
      preloadedData = { ...preloadedData, module_ids: [value] };
    } else if (groupByKey === "created_by") {
      preloadedData = { ...preloadedData };
    } else {
      preloadedData = { ...preloadedData, [groupByKey]: value };
    }
  }

  return preloadedData;
};

export const ListGroup = observer(function ListGroup(props: Props) {
  const {
    groupIssueIds = EMPTY_GROUP_ISSUE_IDS,
    group,
    issuesMap,
    group_by,
    orderBy,
    getGroupIndex,
    updateIssue,
    quickActions,
    displayProperties,
    enableIssueQuickAdd,
    canEditProperties,
    containerRef,
    quickAddCallback,
    handleOnDrop,
    disableIssueCreation,
    addIssuesToView,
    isCompletedCycle,
    showEmptyGroup,
    loadMoreIssues,
    selectionHelpers,
    handleCollapsedGroups,
    collapsedGroups,
    isEpic = false,
  } = props;

  const isExpanded = !collapsedGroups?.group_by.includes(group.id);
  const projectState = useProjectState();

  const {
    issues: { getGroupIssueCount, getPaginationData },
  } = useIssuesStore();

  const { workflowDisabledSource, isWorkflowDropDisabled, handleWorkFlowState, getIsWorkflowWorkItemCreationDisabled } =
    useWorkFlowFDragNDrop(group_by);
  const isWorkflowIssueCreationDisabled = getIsWorkflowWorkItemCreationDisabled(group.id);
  const { groupRef, isDraggingOverColumn, dragColumnOrientation, isDropDisabled, canOverlayBeVisible } =
    useListGroupDropTarget({
      group,
      orderBy,
      getGroupIndex,
      isWorkflowDropDisabled,
      isExpanded,
      handleWorkFlowState,
      handleOnDrop,
      handleCollapsedGroups,
    });

  const groupIssueCount = getGroupIssueCount(group.id, undefined, false) ?? 0;
  const nextPageResults = getPaginationData(group.id, undefined)?.nextPageResults;
  const shouldLoadMore = getShouldLoadMore(nextPageResults, groupIssueCount, groupIssueIds);

  const validateEmptyIssueGroups = (issueCount: number = 0) => {
    if (!showEmptyGroup && issueCount <= 0) return false;
    return true;
  };

  const isDragAllowed = group_by ? DRAG_ALLOWED_GROUPS.includes(group_by) : true;

  const isGroupByCreatedBy = group_by === "created_by";
  const isIssueCreationDisabled =
    disableIssueCreation || isGroupByCreatedBy || isCompletedCycle || isWorkflowIssueCreationDisabled;
  const shouldExpand = (!!groupIssueCount && isExpanded) || !group_by;

  return validateEmptyIssueGroups(groupIssueCount) ? (
    <div
      ref={groupRef}
      className={cn(`relative flex flex-shrink-0 flex-col`, {
        "border-accent-strong": isDraggingOverColumn,
        "border-danger-subtle": isDraggingOverColumn && isDropDisabled,
      })}
    >
      <Row
        className={cn("w-full flex-shrink-0 border-b border-subtle bg-surface-1 pr-3", {
          "sticky top-0 z-[2]": isExpanded && groupIssueCount > 0,
        })}
      >
        <HeaderGroupByCard
          isExpanded={shouldExpand}
          groupID={group.id}
          groupBy={group_by}
          icon={group.icon}
          title={group.name}
          count={groupIssueCount}
          issuePayload={group.payload}
          canEditProperties={canEditProperties}
          disableIssueCreation={isIssueCreationDisabled}
          addIssuesToView={addIssuesToView}
          selectionHelpers={selectionHelpers}
          handleCollapsedGroups={handleCollapsedGroups}
          isEpic={isEpic}
        />
      </Row>
      {shouldExpand && (
        <div className="relative">
          <GroupDragOverlay
            dragColumnOrientation={dragColumnOrientation}
            canOverlayBeVisible={canOverlayBeVisible}
            isDropDisabled={isDropDisabled}
            workflowDisabledSource={workflowDisabledSource}
            dropErrorMessage={group.dropErrorMessage}
            orderBy={orderBy}
            isDraggingOverColumn={isDraggingOverColumn}
            isEpic={isEpic}
          />
          <IssueBlocksList
            issueIds={groupIssueIds}
            groupId={group.id}
            issuesMap={issuesMap}
            updateIssue={updateIssue}
            quickActions={quickActions}
            displayProperties={displayProperties}
            canEditProperties={canEditProperties}
            containerRef={containerRef}
            isDragAllowed={isDragAllowed}
            canDropOverIssue={!canOverlayBeVisible}
            selectionHelpers={selectionHelpers}
            isEpic={isEpic}
          />

          {shouldLoadMore && (
            <ListGroupLoadMore
              groupId={group.id}
              groupBy={group_by}
              containerRef={containerRef}
              loadMoreIssues={loadMoreIssues}
            />
          )}

          {enableIssueQuickAdd && !isIssueCreationDisabled && (
            <div className="sticky bottom-0 z-[1] w-full flex-shrink-0">
              <QuickAddIssueRoot
                layout={EIssueLayoutTypes.LIST}
                QuickAddButton={ListQuickAddIssueButton}
                prePopulatedData={prePopulateQuickAddData(projectState.projectStates, group_by, group.id)}
                containerClassName="border-b border-subtle bg-surface-1"
                quickAddCallback={quickAddCallback}
                isEpic={isEpic}
              />
            </div>
          )}
        </div>
      )}
    </div>
  ) : null;
});
