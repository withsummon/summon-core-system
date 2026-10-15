/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { Dispatch, MouseEvent, SetStateAction } from "react";
import { useEffect, useRef } from "react";
import { combine } from "@atlaskit/pragmatic-drag-and-drop/combine";
import { draggable } from "@atlaskit/pragmatic-drag-and-drop/element/adapter";
import { observer } from "mobx-react";
import { useParams } from "next/navigation";
// types
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import { Tooltip } from "@plane/propel/tooltip";
import type { TIssue, IIssueDisplayProperties, TIssueMap } from "@plane/types";
import { EIssueServiceType } from "@plane/types";
// ui
import { ControlLink, Row } from "@plane/ui";
import { cn, generateWorkItemLink } from "@plane/utils";
// components
// hooks
import { useAppTheme } from "@/hooks/store/use-app-theme";
import { useIssueDetail } from "@/hooks/store/use-issue-detail";
import { useProject } from "@/hooks/store/use-project";
import type { TSelectionHelper } from "@/hooks/use-multiple-select";
import { usePlatformOS } from "@/hooks/use-platform-os";
import { ListBlockLeadingControls } from "./block-leading-controls";
import { ListBlockTrailingControls } from "./block-trailing-controls";
import type { TRenderQuickActions } from "./list-view-types";

interface IssueBlockProps {
  issueId: string;
  issuesMap: TIssueMap;
  groupId: string;
  updateIssue: ((projectId: string | null, issueId: string, data: Partial<TIssue>) => Promise<void>) | undefined;
  quickActions: TRenderQuickActions;
  displayProperties: IIssueDisplayProperties | undefined;
  canEditProperties: (projectId: string | undefined) => boolean;
  nestingLevel: number;
  spacingLeft?: number;
  isExpanded: boolean;
  setExpanded: Dispatch<SetStateAction<boolean>>;
  selectionHelpers: TSelectionHelper;
  isCurrentBlockDragging: boolean;
  setIsCurrentBlockDragging: React.Dispatch<React.SetStateAction<boolean>>;
  canDrag: boolean;
  isEpic?: boolean;
}

type TRowState = {
  isPeeked: boolean;
  isPeekedAtThisLevel: boolean;
  isActive: boolean;
  isSelected: boolean;
  isDragging: boolean;
  isSidebarCollapsed: boolean | undefined;
};

const getRowClassName = (state: TRowState) =>
  cn(
    "group/list-block relative flex min-h-11 flex-col gap-2 bg-layer-transparent py-2 text-13 transition-colors hover:bg-layer-transparent-hover",
    {
      "border-accent-strong": state.isPeeked && state.isPeekedAtThisLevel,
      "border-strong-1": state.isActive,
      "last:border-b-transparent": !state.isPeeked && !state.isActive,
      "bg-accent-primary/5 hover:bg-accent-primary/10": state.isSelected,
      "bg-layer-1": state.isDragging,
      "md:flex-row md:items-center": state.isSidebarCollapsed,
      "lg:flex-row lg:items-center": !state.isSidebarCollapsed,
    }
  );

export const IssueBlock = observer(function IssueBlock(props: IssueBlockProps) {
  const {
    issuesMap,
    issueId,
    groupId,
    updateIssue,
    quickActions,
    displayProperties,
    canEditProperties,
    nestingLevel,
    spacingLeft = 14,
    isExpanded,
    setExpanded,
    selectionHelpers,
    isCurrentBlockDragging,
    setIsCurrentBlockDragging,
    canDrag,
    isEpic = false,
  } = props;
  // ref
  const issueRef = useRef<HTMLDivElement | null>(null);
  // router
  const { workspaceSlug: routerWorkspaceSlug, projectId: routerProjectId } = useParams();
  const workspaceSlug = routerWorkspaceSlug?.toString();
  const projectId = routerProjectId?.toString();
  // hooks
  const { sidebarCollapsed: isSidebarCollapsed } = useAppTheme();
  const { getProjectIdentifierById, currentProjectNextSequenceId } = useProject();
  const {
    getIsIssuePeeked,
    peekIssue,
    setPeekIssue,
    subIssues: subIssuesStore,
  } = useIssueDetail(isEpic ? EIssueServiceType.EPICS : EIssueServiceType.ISSUES);

  const handleIssuePeekOverview = (issue: TIssue) =>
    workspaceSlug &&
    issue &&
    issue.project_id &&
    issue.id &&
    !getIsIssuePeeked(issue.id) &&
    setPeekIssue({
      workspaceSlug,
      projectId: issue.project_id,
      issueId: issue.id,
      nestingLevel: nestingLevel,
      isArchived: !!issue.archived_at,
    });

  // derived values
  const issue = issuesMap[issueId];
  const subIssuesCount = issue?.sub_issues_count ?? 0;
  const canEditIssueProperties = canEditProperties(issue?.project_id ?? undefined);
  const isDraggingAllowed = canDrag && canEditIssueProperties;

  const { isMobile } = usePlatformOS();

  useEffect(() => {
    const element = issueRef.current;

    if (!element) return;

    return combine(
      draggable({
        element,
        canDrag: () => isDraggingAllowed,
        getInitialData: () => ({ id: issueId, type: "ISSUE", groupId }),
        onDragStart: () => {
          setIsCurrentBlockDragging(true);
        },
        onDrop: () => {
          setIsCurrentBlockDragging(false);
        },
      })
    );
  }, [isDraggingAllowed, issueId, groupId, setIsCurrentBlockDragging]);

  if (!issue) return null;

  const projectIdentifier = getProjectIdentifierById(issue.project_id);
  const isIssueSelected = selectionHelpers.getIsEntitySelected(issue.id);
  const isIssueActive = selectionHelpers.getIsEntityActive(issue.id);
  const canSelectIssues = canEditIssueProperties && !selectionHelpers.isSelectionDisabled;

  const handleToggleExpand = (e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    e.preventDefault();
    if (nestingLevel >= 3) {
      handleIssuePeekOverview(issue);
    } else {
      setExpanded((prevState) => {
        if (!prevState && workspaceSlug && issue && issue.project_id)
          subIssuesStore.fetchSubIssues(workspaceSlug.toString(), issue.project_id, issue.id);
        return !prevState;
      });
    }
  };

  const workItemLink = generateWorkItemLink({
    workspaceSlug,
    projectId: issue.project_id,
    issueId,
    projectIdentifier,
    sequenceId: issue.sequence_id,
    isEpic,
    isArchived: !!issue.archived_at,
  });
  const isTemporary = issue.tempId !== undefined;
  return (
    <ControlLink
      id={`issue-${issue.id}`}
      href={workItemLink}
      aria-label={`${projectIdentifier}-${issue.sequence_id}: ${issue.name}`}
      onClick={() => handleIssuePeekOverview(issue)}
      className="w-full cursor-pointer focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent-strong focus-visible:outline-solid"
      disabled={isTemporary || issue.is_draft}
    >
      <Row
        ref={issueRef}
        className={getRowClassName({
          isPeeked: getIsIssuePeeked(issue.id),
          isPeekedAtThisLevel: peekIssue?.nestingLevel === nestingLevel,
          isActive: isIssueActive,
          isSelected: isIssueSelected,
          isDragging: isCurrentBlockDragging,
          isSidebarCollapsed,
        })}
        onDragStart={() => {
          if (!isDraggingAllowed) {
            setToast({
              type: TOAST_TYPE.WARNING,
              title: "Cannot move work item",
              message: !canEditIssueProperties
                ? "You are not allowed to move this work item"
                : "Drag and drop is disabled for the current grouping",
            });
          }
        }}
      >
        <div className="flex w-full gap-2 truncate">
          <div className="flex flex-grow items-center gap-0.5 truncate">
            <ListBlockLeadingControls
              issue={issue}
              groupId={groupId}
              projectId={projectId}
              projectIdentifier={projectIdentifier}
              maxSequenceId={currentProjectNextSequenceId}
              displayProperties={displayProperties}
              selectionHelpers={selectionHelpers}
              isSelected={isIssueSelected}
              canSelect={canSelectIssues && !isEpic}
              showSubIssueToggle={subIssuesCount > 0 && !isEpic}
              isExpanded={isExpanded}
              onToggleExpand={handleToggleExpand}
              marginLeft={nestingLevel !== 0 ? spacingLeft : undefined}
              isTemporary={isTemporary}
              isReadOnly={!canEditIssueProperties}
              updateIssue={updateIssue}
            />

            <Tooltip
              tooltipContent={issue.name}
              isMobile={isMobile}
              position="top-start"
              disabled={isCurrentBlockDragging}
              renderByDefault={false}
            >
              <p className="cursor-pointer truncate text-body-xs-medium text-primary">{issue.name}</p>
            </Tooltip>
          </div>
          {!isTemporary && (
            <div
              className={cn("block rounded-sm border border-strong", {
                "md:hidden": isSidebarCollapsed,
                "lg:hidden": !isSidebarCollapsed,
              })}
            >
              {quickActions({
                issue,
                parentRef: issueRef,
              })}
            </div>
          )}
        </div>
        <div className="flex flex-shrink-0 items-center gap-2">
          <ListBlockTrailingControls
            issue={issue}
            issueRef={issueRef}
            isTemporary={isTemporary}
            isSidebarCollapsed={isSidebarCollapsed}
            canEditIssueProperties={canEditIssueProperties}
            updateIssue={updateIssue}
            quickActions={quickActions}
            displayProperties={displayProperties}
            isEpic={isEpic}
          />
        </div>
      </Row>
    </ControlLink>
  );
});
