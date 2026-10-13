/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useEffect, useRef, useState } from "react";
import { combine } from "@atlaskit/pragmatic-drag-and-drop/combine";
import { dropTargetForElements } from "@atlaskit/pragmatic-drag-and-drop/element/adapter";
import { useTranslation } from "@plane/i18n";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import type { IGroupByColumn, TIssueOrderByOptions } from "@plane/types";
// local imports
import type { GroupDropLocation } from "../utils";
import {
  getDestinationFromDropPayload,
  getIssueBlockId,
  getSourceFromDropPayload,
  highlightIssueOnDrop,
} from "../utils";

type TDropHandlers = {
  handleWorkFlowState: (sourceGroupId: string, destinationGroupId: string) => void;
  handleOnDrop: (source: GroupDropLocation, destination: GroupDropLocation) => Promise<void>;
  handleCollapsedGroups: (value: string) => void;
};

type TArgs = TDropHandlers & {
  group: IGroupByColumn;
  orderBy: TIssueOrderByOptions | undefined;
  getGroupIndex: (groupId: string | undefined) => number;
  isWorkflowDropDisabled: boolean;
  isExpanded: boolean;
};

/** Registers a list group as a drop target and tracks drag-over state for its overlay. */
export const useListGroupDropTarget = (args: TArgs) => {
  const { group, orderBy, getGroupIndex, isWorkflowDropDisabled, isExpanded } = args;
  const { t } = useTranslation();
  const groupRef = useRef<HTMLDivElement | null>(null);
  const [isDraggingOverColumn, setIsDraggingOverColumn] = useState(false);
  const [dragColumnOrientation, setDragColumnOrientation] = useState<"justify-start" | "justify-end">("justify-start");

  // These callbacks change identity every render; read the latest ones so the drop target is not re-registered mid-drag.
  const handlersRef = useRef<TDropHandlers>(args);
  useEffect(() => {
    handlersRef.current = {
      handleWorkFlowState: args.handleWorkFlowState,
      handleOnDrop: args.handleOnDrop,
      handleCollapsedGroups: args.handleCollapsedGroups,
    };
  });

  useEffect(() => {
    const element = groupRef.current;

    if (!element) return;

    return combine(
      dropTargetForElements({
        element,
        getData: () => ({ groupId: group.id, type: "COLUMN" }),
        onDragEnter: () => {
          setIsDraggingOverColumn(true);
        },
        onDragLeave: () => {
          setIsDraggingOverColumn(false);
        },
        onDragStart: () => {
          setIsDraggingOverColumn(true);
        },
        onDrag: ({ source }) => {
          const sourceGroupId = source?.data?.groupId as string | undefined;
          const currentGroupId = group.id;

          if (sourceGroupId) handlersRef.current.handleWorkFlowState(sourceGroupId, currentGroupId);

          const sourceIndex = getGroupIndex(sourceGroupId);
          const currentIndex = getGroupIndex(currentGroupId);

          if (sourceIndex > currentIndex) {
            setDragColumnOrientation("justify-end");
          } else {
            setDragColumnOrientation("justify-start");
          }
        },
        onDrop: (payload) => {
          setIsDraggingOverColumn(false);
          const source = getSourceFromDropPayload(payload);
          const destination = getDestinationFromDropPayload(payload);

          if (!source || !destination) return;

          if (isWorkflowDropDisabled || group.isDropDisabled) {
            if (group.dropErrorMessage)
              setToast({
                type: TOAST_TYPE.WARNING,
                title: t("common.warning"),
                message: group.dropErrorMessage,
              });
            return;
          }

          handlersRef.current.handleOnDrop(source, destination);

          highlightIssueOnDrop(getIssueBlockId(source.id, destination?.groupId), orderBy !== "sort_order");

          if (!isExpanded) {
            handlersRef.current.handleCollapsedGroups(group.id);
          }
        },
      })
    );
  }, [group, orderBy, getGroupIndex, isWorkflowDropDisabled, isExpanded, t]);

  const isDropDisabled = isWorkflowDropDisabled || !!group.isDropDisabled;
  const canOverlayBeVisible = isDropDisabled || orderBy !== "sort_order";

  return { groupRef, isDraggingOverColumn, dragColumnOrientation, isDropDisabled, canOverlayBeVisible };
};
