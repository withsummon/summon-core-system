/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { ComponentProps, MutableRefObject, ReactElement, ReactNode, RefObject } from "react";
import { useEffect, useRef, useState } from "react";
import { combine } from "@atlaskit/pragmatic-drag-and-drop/combine";
import { draggable, dropTargetForElements } from "@atlaskit/pragmatic-drag-and-drop/element/adapter";
import { observer } from "mobx-react";
import { useParams } from "next/navigation";
// plane helpers
import { MoreHorizontal } from "lucide-react";
import { useOutsideClickDetector } from "@plane/hooks";
// types
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import { Tooltip } from "@plane/propel/tooltip";
import type { TIssue, IIssueDisplayProperties, IIssueMap } from "@plane/types";
import { EIssueServiceType } from "@plane/types";
// ui
import { ControlLink, DropIndicator } from "@plane/ui";
import { cn, generateWorkItemLink } from "@plane/utils";
// components
import RenderIfVisible from "@/components/core/render-if-visible-HOC";
import { HIGHLIGHT_CLASS, getIssueBlockId } from "@/components/issues/issue-layouts/utils";
import { IssueIdentifier } from "@/components/issues/issue-detail/issue-identifier";
// hooks
import { useIssueDetail } from "@/hooks/store/use-issue-detail";
import { useKanbanView } from "@/hooks/store/use-kanban-view";
import { useProject } from "@/hooks/store/use-project";
import useIssuePeekOverviewRedirection from "@/hooks/use-issue-peek-overview-redirection";
import { usePlatformOS } from "@/hooks/use-platform-os";
// local components
import type { TRenderQuickActions } from "../list/list-view-types";
import { IssueProperties } from "../properties/all-properties";

interface IssueBlockProps {
  issueId: string;
  groupId: string;
  subGroupId: string;
  issuesMap: IIssueMap;
  displayProperties: IIssueDisplayProperties | undefined;
  draggableId: string;
  canDropOverIssue: boolean;
  canDragIssuesInCurrentGrouping: boolean;
  updateIssue: ((projectId: string | null, issueId: string, data: Partial<TIssue>) => Promise<void>) | undefined;
  quickActions: TRenderQuickActions;
  canEditProperties: (projectId: string | undefined) => boolean;
  scrollableContainerRef?: MutableRefObject<HTMLDivElement | null>;
  shouldRenderByDefault?: boolean;
  isEpic?: boolean;
}

interface KanbanIssueBlockViewProps {
  issueId: string;
  blockId: string;
  href: ComponentProps<typeof ControlLink>["href"];
  name: string;
  onOpen: ComponentProps<typeof ControlLink>["onClick"];
  cardRef: RefObject<HTMLDivElement>;
  onDragStart: ComponentProps<"div">["onDragStart"];
  isPeeked: boolean;
  isDragging: boolean;
  isDraggingOver: boolean;
  canDrag: boolean;
  disabled: boolean;
  identifier: ReactNode;
  properties: ReactNode;
  actions: (cardRef: RefObject<HTMLDivElement>, customActionContent: ReactElement) => ReactNode;
  scrollableContainerRef?: ComponentProps<typeof RenderIfVisible>["root"];
  shouldRenderByDefault?: boolean;
}

export function KanbanIssueBlockView({
  issueId,
  blockId,
  href,
  name,
  onOpen,
  cardRef,
  onDragStart,
  isPeeked,
  isDragging,
  isDraggingOver,
  canDrag,
  disabled,
  identifier,
  properties,
  actions,
  scrollableContainerRef,
  shouldRenderByDefault,
}: KanbanIssueBlockViewProps) {
  const { isMobile } = usePlatformOS();

  return (
    <>
      <DropIndicator isVisible={!isDragging && isDraggingOver} />
      <div
        id={`issue-${issueId}`}
        // make Z-index higher at the beginning of drag, to have a issue drag image of issue block without any overlaps
        className={cn("group/kanban-block relative mb-2", { "z-[1]": isDragging })}
        onDragStart={onDragStart}
      >
        <div
          id={blockId}
          ref={cardRef}
          className={cn(
            "relative block w-full rounded-lg border border-subtle bg-layer-2 p-3 text-13 shadow-raised-100 outline-[0.5px] outline-transparent transition-all hover:border-strong hover:shadow-raised-200",
            { "hover:cursor-pointer": canDrag },
            { "border border-accent-strong hover:border-accent-strong": isPeeked },
            { "z-[100] bg-layer-1": isDragging }
          )}
        >
          <Tooltip tooltipContent={name} isMobile={isMobile} renderByDefault={false}>
            <ControlLink
              href={href}
              aria-label={`Open ${name}`}
              onClick={onOpen}
              disabled={disabled}
              className="absolute inset-0 z-[1] rounded-lg focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent-strong"
            >
              <span className="sr-only">{name}</span>
            </ControlLink>
          </Tooltip>
          <RenderIfVisible
            classNames="space-y-2"
            root={scrollableContainerRef}
            defaultHeight="100px"
            horizontalOffset={100}
            verticalOffset={200}
            defaultValue={shouldRenderByDefault}
          >
            <div className="relative">
              {identifier}
              <div
                className={cn(
                  "absolute -top-1 right-0 z-[2] group-focus-within/kanban-block:block has-[[aria-expanded=true]]:block",
                  { "hidden group-hover/kanban-block:block": !isMobile }
                )}
              >
                {actions(
                  cardRef,
                  <div className="flex h-full w-full cursor-pointer items-center rounded-sm p-1 text-secondary hover:bg-layer-1 in-[[aria-expanded=true]]:bg-layer-1 in-[[aria-expanded=true]]:text-primary">
                    <MoreHorizontal className="h-3.5 w-3.5" />
                  </div>
                )}
              </div>
            </div>
            <div className="line-clamp-1 w-full text-body-sm-medium text-primary">
              <span>{name}</span>
            </div>
            <div className="relative z-[2] flex flex-wrap items-center gap-2 pt-1.5 whitespace-nowrap text-tertiary">
              {properties}
            </div>
          </RenderIfVisible>
        </div>
      </div>
    </>
  );
}

export const KanbanIssueBlock = observer(function KanbanIssueBlock(props: IssueBlockProps) {
  const {
    issueId,
    groupId,
    subGroupId,
    issuesMap,
    displayProperties,
    canDropOverIssue,
    canDragIssuesInCurrentGrouping,
    updateIssue,
    quickActions,
    canEditProperties,
    scrollableContainerRef,
    shouldRenderByDefault,
    isEpic = false,
  } = props;

  const cardRef = useRef<HTMLDivElement | null>(null);
  // router
  const { workspaceSlug: routerWorkspaceSlug } = useParams();
  const workspaceSlug = routerWorkspaceSlug?.toString();
  // hooks
  const { getProjectIdentifierById } = useProject();
  const { getIsIssuePeeked } = useIssueDetail(isEpic ? EIssueServiceType.EPICS : EIssueServiceType.ISSUES);
  const { handleRedirection } = useIssuePeekOverviewRedirection(isEpic);
  const { isMobile } = usePlatformOS();

  // handlers
  const handleIssuePeekOverview = (issue: TIssue) => handleRedirection(workspaceSlug, issue, isMobile);

  const issue = issuesMap[issueId];

  const { setIsDragging: setIsKanbanDragging } = useKanbanView();

  const [isDraggingOverBlock, setIsDraggingOverBlock] = useState(false);
  const [isCurrentBlockDragging, setIsCurrentBlockDragging] = useState(false);

  const canEditIssueProperties = canEditProperties(issue?.project_id ?? undefined);

  const isDragAllowed = canDragIssuesInCurrentGrouping && !issue?.tempId && canEditIssueProperties;
  const projectIdentifier = getProjectIdentifierById(issue?.project_id);

  const workItemLink = generateWorkItemLink({
    workspaceSlug,
    projectId: issue?.project_id,
    issueId,
    projectIdentifier,
    sequenceId: issue?.sequence_id,
    isEpic,
    isArchived: !!issue?.archived_at,
  });

  useOutsideClickDetector(cardRef, () => {
    cardRef?.current?.classList?.remove(HIGHLIGHT_CLASS);
  });

  // Make Issue block both as as Draggable and,
  // as a DropTarget for other issues being dragged to get the location of drop
  useEffect(() => {
    const element = cardRef.current;

    if (!element) return;

    return combine(
      draggable({
        element,
        dragHandle: element,
        canDrag: () => isDragAllowed,
        getInitialData: () => ({ id: issue?.id, type: "ISSUE" }),
        onDragStart: () => {
          setIsCurrentBlockDragging(true);
          setIsKanbanDragging(true);
        },
        onDrop: () => {
          setIsKanbanDragging(false);
          setIsCurrentBlockDragging(false);
        },
      }),
      dropTargetForElements({
        element,
        canDrop: ({ source }) => source?.data?.id !== issue?.id && canDropOverIssue,
        getData: () => ({ id: issue?.id, type: "ISSUE" }),
        onDragEnter: () => {
          setIsDraggingOverBlock(true);
        },
        onDragLeave: () => {
          setIsDraggingOverBlock(false);
        },
        onDrop: () => {
          setIsDraggingOverBlock(false);
        },
      })
    );
    // oxlint-disable-next-line eslint-plugin-react-hooks/exhaustive-deps
  }, [cardRef?.current, issue?.id, isDragAllowed, canDropOverIssue, setIsCurrentBlockDragging, setIsDraggingOverBlock]);

  if (!issue) return null;

  return (
    <KanbanIssueBlockView
      issueId={issueId}
      blockId={getIssueBlockId(issueId, groupId, subGroupId)}
      href={workItemLink}
      name={issue.name}
      onOpen={() => handleIssuePeekOverview(issue)}
      cardRef={cardRef}
      onDragStart={() => {
        if (isDragAllowed) setIsCurrentBlockDragging(true);
        else {
          setToast({
            type: TOAST_TYPE.WARNING,
            title: "Cannot move work item",
            message: !canEditIssueProperties
              ? "You are not allowed to move this work item"
              : "Drag and drop is disabled for the current grouping",
          });
        }
      }}
      isPeeked={getIsIssuePeeked(issue.id)}
      isDragging={isCurrentBlockDragging}
      isDraggingOver={isDraggingOverBlock}
      canDrag={isDragAllowed}
      disabled={!!issue.tempId}
      identifier={
        issue.project_id && (
          <IssueIdentifier
            issueId={issue.id}
            projectId={issue.project_id}
            size="xs"
            variant="tertiary"
            displayProperties={displayProperties}
          />
        )
      }
      properties={
        <IssueProperties
          className="contents"
          issue={issue}
          displayProperties={displayProperties}
          activeLayout="Kanban"
          updateIssue={updateIssue}
          isReadOnly={!canEditIssueProperties}
          isEpic={isEpic}
        />
      }
      actions={(parentRef, customActionButton) => quickActions({ issue, parentRef, customActionButton })}
      scrollableContainerRef={scrollableContainerRef}
      shouldRenderByDefault={shouldRenderByDefault}
    />
  );
});
