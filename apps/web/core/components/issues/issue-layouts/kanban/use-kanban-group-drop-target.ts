/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useEffect, useRef, useState } from "react";
import { combine } from "@atlaskit/pragmatic-drag-and-drop/combine";
import { dropTargetForElements } from "@atlaskit/pragmatic-drag-and-drop/element/adapter";
import { autoScrollForElements } from "@atlaskit/pragmatic-drag-and-drop-auto-scroll/element";
import { useTranslation } from "@plane/i18n";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import type { TIssueOrderByOptions } from "@plane/types";
// local imports
import type { GroupDropLocation } from "../utils";
import {
  getDestinationFromDropPayload,
  getIssueBlockId,
  getSourceFromDropPayload,
  highlightIssueOnDrop,
} from "../utils";

type TDropHandlers = {
  handleWorkFlowState: (
    sourceGroupId: string,
    destinationGroupId: string,
    sourceSubGroupId?: string,
    destinationSubGroupId?: string
  ) => void;
  handleOnDrop: (source: GroupDropLocation, destination: GroupDropLocation) => Promise<void>;
};

type TArgs = TDropHandlers & {
  groupId: string;
  subGroupId: string;
  orderBy: TIssueOrderByOptions | undefined;
  isDropDisabled: boolean;
  dropErrorMessage: string | undefined;
};

/** Registers a kanban column as a drop target (with auto-scroll) and tracks whether an item is dragged over it. */
export const useKanbanGroupDropTarget = (args: TArgs) => {
  const { groupId, subGroupId, orderBy, isDropDisabled, dropErrorMessage } = args;
  const { t } = useTranslation();
  const columnRef = useRef<HTMLDivElement | null>(null);
  const [isDraggingOverColumn, setIsDraggingOverColumn] = useState(false);

  // These callbacks change identity every render; read the latest ones so the drop target is not re-registered mid-drag.
  const handlersRef = useRef<TDropHandlers>(args);
  useEffect(() => {
    handlersRef.current = { handleWorkFlowState: args.handleWorkFlowState, handleOnDrop: args.handleOnDrop };
  });

  useEffect(() => {
    const element = columnRef.current;

    if (!element) return;

    const handleDragOver = (payload: Parameters<typeof getSourceFromDropPayload>[0]) => {
      const source = getSourceFromDropPayload(payload);
      setIsDraggingOverColumn(true);
      // handle if dragging a workflowState
      if (source) handlersRef.current.handleWorkFlowState(source.groupId, groupId, source.subGroupId, subGroupId);
    };

    return combine(
      dropTargetForElements({
        element,
        getData: () => ({ groupId, subGroupId, columnId: `${groupId}__${subGroupId}`, type: "COLUMN" }),
        onDragEnter: handleDragOver,
        onDragLeave: () => {
          setIsDraggingOverColumn(false);
        },
        onDragStart: handleDragOver,
        onDrop: (payload) => {
          setIsDraggingOverColumn(false);
          const source = getSourceFromDropPayload(payload);
          const destination = getDestinationFromDropPayload(payload);

          if (!source || !destination) return;

          if (isDropDisabled && dropErrorMessage) {
            setToast({
              type: TOAST_TYPE.WARNING,
              title: t("common.warning"),
              message: dropErrorMessage,
            });
            return;
          }

          handlersRef.current.handleOnDrop(source, destination);

          highlightIssueOnDrop(
            getIssueBlockId(source.id, destination.groupId, destination.subGroupId),
            orderBy !== "sort_order"
          );
        },
      }),
      autoScrollForElements({
        element,
      })
    );
  }, [groupId, subGroupId, orderBy, isDropDisabled, dropErrorMessage, t]);

  return { columnRef, isDraggingOverColumn };
};
