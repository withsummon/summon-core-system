/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { ComponentProps, Dispatch, MouseEvent, ReactNode, RefObject, SetStateAction } from "react";
import { useEffect, useRef } from "react";
import { combine } from "@atlaskit/pragmatic-drag-and-drop/combine";
import { draggable } from "@atlaskit/pragmatic-drag-and-drop/element/adapter";
import { observer } from "mobx-react";
import { useParams } from "next/navigation";
import { ChevronRightIcon } from "@plane/propel/icons";
// types
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import { Tooltip } from "@plane/propel/tooltip";
import type { TIssue, IIssueDisplayProperties, TIssueMap } from "@plane/types";
import { EIssueServiceType } from "@plane/types";
// ui
import { Spinner, ControlLink, Row } from "@plane/ui";
import { cn, generateWorkItemLink } from "@plane/utils";
// components
import { MultipleSelectEntityAction } from "@/components/core/multiple-select";
import { IssueProperties } from "@/components/issues/issue-layouts/properties";
import { IssueIdentifier } from "@/components/issues/issue-detail/issue-identifier";
// hooks
import { useIssueDetail } from "@/hooks/store/use-issue-detail";
import { useProject } from "@/hooks/store/use-project";
import type { TSelectionHelper } from "@/hooks/use-multiple-select";
import { usePlatformOS } from "@/hooks/use-platform-os";
import { calculateIdentifierWidth } from "../utils";
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

interface IssueListBlockViewProps {
  issueId: string;
  href: ComponentProps<typeof ControlLink>["href"];
  name: string;
  ariaLabel: string;
  onOpen: ComponentProps<typeof ControlLink>["onClick"];
  rowRef: RefObject<HTMLDivElement>;
  onDragStart: ComponentProps<typeof Row>["onDragStart"];
  isPeeked: boolean;
  isPeekedAtCurrentLevel: boolean;
  isActive: boolean;
  isSelected: boolean;
  isDragging: boolean;
  disabled: boolean;
  pending: boolean;
  identifier: ReactNode;
  indent: number;
  selection: ReactNode;
  expansion: ReactNode;
  properties: ReactNode;
  actions?: (rowRef: RefObject<HTMLDivElement>) => ReactNode;
}

export function IssueListBlockView({
  issueId,
  href,
  name,
  ariaLabel,
  onOpen,
  rowRef,
  onDragStart,
  isPeeked,
  isPeekedAtCurrentLevel,
  isActive,
  isSelected,
  isDragging,
  disabled,
  pending,
  identifier,
  indent,
  selection,
  expansion,
  properties,
  actions: renderActions,
}: IssueListBlockViewProps) {
  const { isMobile } = usePlatformOS();
  const actions = pending ? undefined : renderActions;

  return (
    <div className="@container/list-row block w-full">
      <Row
        id={`issue-${issueId}`}
        ref={rowRef}
        className={cn(
          "group/list-block relative grid min-h-11 w-full grid-cols-[minmax(0,1fr)_auto] gap-3 bg-layer-transparent py-3 text-13 transition-colors hover:bg-layer-transparent-hover @3xl/list-row:grid-cols-[minmax(12rem,1fr)_minmax(0,max-content)_auto] @3xl/list-row:items-center",
          {
            "border-accent-strong": isPeeked && isPeekedAtCurrentLevel,
            "border-strong-1": isActive,
            "last:border-b-transparent": !isPeeked && !isActive,
            "bg-accent-primary/5 hover:bg-accent-primary/10": isSelected,
            "bg-layer-1": isDragging,
          }
        )}
        onDragStart={onDragStart}
      >
        <div className="flex w-full gap-2 truncate">
          <div className="flex flex-grow items-center gap-0.5 truncate">
            <div className="flex items-center gap-1" style={{ marginLeft: indent }}>
              <div className="contents [&>*]:z-[2]">{selection}</div>
              {identifier}
              <div className="relative z-[2] grid size-4 flex-shrink-0 place-items-center">{expansion}</div>
              {pending && (
                <div className="absolute top-0 left-0 z-[99999] h-full w-full animate-pulse bg-surface-1/20" />
              )}
            </div>
            <Tooltip
              tooltipContent={name}
              isMobile={isMobile}
              position="top-start"
              disabled={isDragging}
              renderByDefault={false}
            >
              <ControlLink
                href={href}
                aria-label={ariaLabel}
                onClick={onOpen}
                className="min-w-0 flex-1 cursor-pointer truncate text-body-xs-medium text-primary focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent-strong"
                disabled={pending || disabled}
              >
                {name}
              </ControlLink>
            </Tooltip>
          </div>
        </div>
        <div className="relative z-[2] col-span-2 flex min-w-0 items-center gap-2 @3xl/list-row:col-span-1 @3xl/list-row:col-start-2 @3xl/list-row:row-start-1">
          <div className="relative flex flex-wrap items-center gap-2 whitespace-nowrap">
            {pending ? <Spinner className="size-4" /> : properties}
          </div>
        </div>
        {actions && (
          <fieldset
            aria-label="Work item actions"
            className="relative z-[2] col-start-2 row-start-1 rounded-sm border border-strong @3xl/list-row:col-start-3 @3xl/list-row:border-0"
          >
            {actions(rowRef)}
          </fieldset>
        )}
      </Row>
    </div>
  );
}

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
  const { workspaceSlug, projectId } = useParams();
  // hooks
  const { getProjectIdentifierById, currentProjectNextSequenceId } = useProject();
  const {
    getIsIssuePeeked,
    peekIssue,
    setPeekIssue,
    subIssues: subIssuesStore,
  } = useIssueDetail(isEpic ? EIssueServiceType.EPICS : EIssueServiceType.ISSUES);

  const handleIssuePeekOverview = (issue: TIssue) =>
    workspaceSlug &&
    issue.project_id &&
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
  const canEditIssueProperties = canEditProperties(issue?.project_id ?? undefined);
  const isDraggingAllowed = canDrag && canEditIssueProperties;

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
  const isSubIssue = nestingLevel !== 0;

  const handleToggleExpand = (e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    e.preventDefault();
    if (nestingLevel >= 3) {
      handleIssuePeekOverview(issue);
    } else {
      setExpanded((prevState) => {
        if (!prevState && workspaceSlug && issue.project_id)
          subIssuesStore.fetchSubIssues(workspaceSlug, issue.project_id, issue.id);
        return !prevState;
      });
    }
  };

  // Calculate width for: projectIdentifier + "-" + dynamic sequence number digits
  // Use next_work_item_sequence from backend (static value from project endpoint)
  const maxSequenceId = currentProjectNextSequenceId ?? 1;
  const keyMinWidth = calculateIdentifierWidth(projectIdentifier?.length ?? 0, maxSequenceId);

  const workItemLink = generateWorkItemLink({
    workspaceSlug,
    projectId: issue.project_id,
    issueId,
    projectIdentifier,
    sequenceId: issue.sequence_id,
    isEpic,
    isArchived: !!issue.archived_at,
  });
  const isIssuePeeked = getIsIssuePeeked(issue.id);

  return (
    <IssueListBlockView
      issueId={issue.id}
      href={workItemLink}
      name={issue.name}
      ariaLabel={`${projectIdentifier}-${issue.sequence_id}: ${issue.name}`}
      onOpen={() => handleIssuePeekOverview(issue)}
      rowRef={issueRef}
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
      isPeeked={isIssuePeeked}
      isPeekedAtCurrentLevel={peekIssue?.nestingLevel === nestingLevel}
      isActive={isIssueActive}
      isSelected={isIssueSelected}
      isDragging={isCurrentBlockDragging}
      disabled={issue.is_draft}
      pending={issue.tempId !== undefined}
      identifier={
        issue.project_id && (
          <IssueIdentifier
            issueId={issueId}
            projectId={issue.project_id}
            minWidth={keyMinWidth}
            size="xs"
            variant="tertiary"
            displayProperties={displayProperties}
          />
        )
      }
      indent={isSubIssue ? spacingLeft : 0}
      selection={
        projectId &&
        canEditIssueProperties &&
        !isEpic && (
          <Tooltip
            tooltipContent={
              <>
                Only work items within the current
                <br />
                project can be selected.
              </>
            }
            disabled={issue.project_id === projectId}
          >
            <div className="absolute left-1 grid w-3.5 flex-shrink-0 place-items-center">
              <MultipleSelectEntityAction
                className={cn(
                  "pointer-events-none opacity-0 transition-opacity group-focus-within/list-block:pointer-events-auto group-focus-within/list-block:opacity-100 group-hover/list-block:pointer-events-auto group-hover/list-block:opacity-100",
                  { "pointer-events-auto opacity-100": isIssueSelected }
                )}
                groupId={groupId}
                id={issue.id}
                selectionHelpers={selectionHelpers}
                disabled={issue.project_id !== projectId}
              />
            </div>
          </Tooltip>
        )
      }
      expansion={
        issue.sub_issues_count > 0 &&
        !isEpic && (
          <button
            type="button"
            className="grid size-4 place-items-center rounded-xs text-placeholder hover:text-tertiary"
            aria-label={isExpanded ? "Collapse sub-work items" : "Expand sub-work items"}
            aria-expanded={isExpanded}
            onClick={handleToggleExpand}
          >
            <ChevronRightIcon className={cn("size-4", { "rotate-90": isExpanded })} strokeWidth={2.5} />
          </button>
        )
      }
      properties={
        <IssueProperties
          className="contents"
          issue={issue}
          isReadOnly={!canEditIssueProperties}
          updateIssue={updateIssue}
          displayProperties={displayProperties}
          activeLayout="List"
          isEpic={isEpic}
        />
      }
      actions={(parentRef) => quickActions({ issue, parentRef })}
    />
  );
});
