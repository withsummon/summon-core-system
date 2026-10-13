/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { combine } from "@atlaskit/pragmatic-drag-and-drop/combine";
import { draggable, dropTargetForElements } from "@atlaskit/pragmatic-drag-and-drop/element/adapter";
import { pointerOutsideOfPreview } from "@atlaskit/pragmatic-drag-and-drop/element/pointer-outside-of-preview";
import { setCustomNativeDragPreview } from "@atlaskit/pragmatic-drag-and-drop/element/set-custom-native-drag-preview";
import { attachInstruction, extractInstruction } from "@atlaskit/pragmatic-drag-and-drop-hitbox/tree-item";
import { createRoot } from "react-dom/client";
// plane imports
import { useTranslation } from "@plane/i18n";
import { Logo } from "@plane/propel/emoji-icon-picker";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import type { TPartialProject, TProject } from "@plane/types";
import { orderJoinedProjects } from "@plane/utils";
// hooks
import { useProject } from "@/hooks/store/use-project";
// local imports
import { highlightIssueOnDrop } from "../../issues/issue-layouts/utils";

export type TProjectDropInstruction = "DRAG_OVER" | "DRAG_BELOW" | undefined;

type TUseProjectItemDragAndDrop = {
  projectId: string;
  project: TPartialProject | undefined;
  disableDrag?: boolean;
  disableDrop?: boolean;
  isLastChild: boolean;
  projectListType: "JOINED" | "FAVORITES";
  handleOnProjectDrop?: (
    sourceId: string | undefined,
    destinationId: string | undefined,
    shouldDropAtEnd: boolean
  ) => void;
};

const getDropInstruction = (data: Record<string | symbol, unknown>, isLastChild: boolean): TProjectDropInstruction => {
  const extractedInstruction = extractInstruction(data)?.type;
  if (!extractedInstruction) return undefined;
  // check if the highlight is to be shown above or below
  return extractedInstruction === "reorder-below" && isLastChild ? "DRAG_BELOW" : "DRAG_OVER";
};

export function useProjectItemDragAndDrop({
  projectId,
  project,
  disableDrag,
  disableDrop,
  isLastChild,
  projectListType,
  handleOnProjectDrop,
}: TUseProjectItemDragAndDrop) {
  const [isDragging, setIsDragging] = useState(false);
  const [instruction, setInstruction] = useState<TProjectDropInstruction>(undefined);
  const projectRef = useRef<HTMLDivElement | null>(null);
  const dragHandleRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const element = projectRef.current;
    const dragHandleElement = dragHandleRef.current;

    if (!element) return;

    return combine(
      draggable({
        element,
        canDrag: () => !disableDrag,
        dragHandle: dragHandleElement ?? undefined,
        getInitialData: () => ({ id: projectId, dragInstanceId: "PROJECTS" }),
        onDragStart: () => {
          setIsDragging(true);
        },
        onDrop: () => {
          setIsDragging(false);
        },
        onGenerateDragPreview: ({ nativeSetDragImage }) => {
          // Add a custom drag image
          setCustomNativeDragPreview({
            getOffset: pointerOutsideOfPreview({ x: "0px", y: "0px" }),
            render: ({ container }) => {
              const root = createRoot(container);
              root.render(
                <div className="flex items-center rounded-sm bg-surface-1 p-1 pr-2 text-13">
                  <div className="grid size-4 flex-shrink-0 place-items-center">
                    {project && <Logo logo={project?.logo_props} />}
                  </div>
                  <p className="truncate text-secondary" title={project?.name}>
                    {project?.name}
                  </p>
                </div>
              );
              return () => root.unmount();
            },
            nativeSetDragImage,
          });
        },
      }),
      dropTargetForElements({
        element,
        canDrop: ({ source }) =>
          !disableDrop && source?.data?.id !== projectId && source?.data?.dragInstanceId === "PROJECTS",
        // oxlint-disable-next-line no-shadow
        getData: ({ input, element }) => {
          const data = { id: projectId };

          // attach instruction for last in list
          return attachInstruction(data, {
            input,
            element,
            currentLevel: 0,
            indentPerLevel: 0,
            mode: isLastChild ? "last-in-group" : "standard",
          });
        },
        onDrag: ({ self }) => {
          setInstruction(getDropInstruction(self.data, isLastChild));
        },
        onDragLeave: () => {
          setInstruction(undefined);
        },
        onDrop: ({ self, source }) => {
          setInstruction(undefined);
          const currentInstruction = getDropInstruction(self.data, isLastChild);
          if (!currentInstruction) return;

          const sourceId = source?.data?.id as string | undefined;
          const destinationId = self?.data?.id as string | undefined;

          handleOnProjectDrop?.(sourceId, destinationId, currentInstruction === "DRAG_BELOW");

          highlightIssueOnDrop(`sidebar-${sourceId}-${projectListType}`);
        },
      })
    );
    // oxlint-disable-next-line eslint-plugin-react-hooks/exhaustive-deps
  }, [projectId, isLastChild, projectListType, handleOnProjectDrop]);

  return { projectRef, dragHandleRef, isDragging, instruction };
}

/**
 * Moves a joined project to a new sidebar position. It reads the store at drop time,
 * so the drag handlers never hold a stale project order.
 */
export function useMoveJoinedProject(workspaceSlug: string) {
  const { t } = useTranslation();
  const projectStore = useProject();
  const { getPartialProjectById } = projectStore;

  return useCallback(
    (sourceId: string | undefined, destinationId: string | undefined, shouldDropAtEnd: boolean) => {
      if (!sourceId || !destinationId || sourceId === destinationId) return;
      const { joinedProjectIds } = projectStore;
      const joinedProjectsList = joinedProjectIds
        .map((id) => getPartialProjectById(id))
        .filter((joinedProject): joinedProject is TProject => !!joinedProject);
      if (joinedProjectsList.length <= 0) return;

      const sourceIndex = joinedProjectIds.indexOf(sourceId);
      const destinationIndex = shouldDropAtEnd ? joinedProjectIds.length : joinedProjectIds.indexOf(destinationId);
      const updatedSortOrder = orderJoinedProjects(sourceIndex, destinationIndex, sourceId, joinedProjectsList);
      if (updatedSortOrder != undefined)
        projectStore.updateProjectView(workspaceSlug, sourceId, { sort_order: updatedSortOrder }).catch(() => {
          setToast({
            type: TOAST_TYPE.ERROR,
            title: t("error"),
            message: t("something_went_wrong"),
          });
        });
    },
    [projectStore, getPartialProjectById, workspaceSlug, t]
  );
}
