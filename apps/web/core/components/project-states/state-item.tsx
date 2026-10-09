/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useEffect, useRef, useState } from "react";
import type { ComponentProps } from "react";
import { combine } from "@atlaskit/pragmatic-drag-and-drop/combine";
import { draggable, dropTargetForElements } from "@atlaskit/pragmatic-drag-and-drop/element/adapter";
import { attachClosestEdge, extractClosestEdge } from "@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge";
import type { FunctionArgs } from "convex/server";
import type { api } from "@summon/convex/api";
import { DropIndicator } from "@plane/ui";
import { cn } from "@plane/utils";
import type { ProjectState } from "./root";
import { StateItemTitle } from "./state-item-title";

type Props = Omit<ComponentProps<typeof StateItemTitle>, "stateCount" | "percentage" | "onMoveUp" | "onMoveDown"> & {
  states: ProjectState[];
  status: ProjectState["status"];
  editor: FunctionArgs<typeof api.tasks.states.save> | null;
};
export function StateItem(props: Props) {
  const { state, states, status, disabled, editor, onReorder } = props;
  const elementRef = useRef<HTMLDivElement | null>(null);
  const [dragging, setDragging] = useState(false);
  const [edge, setEdge] = useState<ReturnType<typeof extractClosestEdge>>(null);
  const groupStates = states.filter((row) => row.status === status);
  const index = groupStates.findIndex((row) => row._id === state._id);
  const canMove = !disabled && editor === null;
  useEffect(() => {
    if (!elementRef.current) return;
    const data = { stateId: state._id };
    return combine(
      draggable({
        element: elementRef.current,
        getInitialData: () => data,
        canDrag: () => canMove && groupStates.length > 1,
        onDragStart: () => setDragging(true),
        onDrop: () => setDragging(false),
      }),
      dropTargetForElements({
        element: elementRef.current,
        canDrop: () => canMove,
        getData: ({ input, element }) => attachClosestEdge(data, { input, element, allowedEdges: ["top", "bottom"] }),
        onDragEnter: ({ self }) => setEdge(extractClosestEdge(self.data)),
        onDrag: ({ self }) => setEdge(extractClosestEdge(self.data)),
        onDragLeave: () => setEdge(null),
        onDrop: ({ source, self }) => {
          setEdge(null);
          const moving = states.find((row) => row._id === source.data.stateId);
          if (!moving || moving._id === state._id) return;
          const targets = states.filter((row) => row.status === status && row._id !== moving._id);
          const targetIndex = targets.findIndex((row) => row._id === state._id);
          const beforeStateId =
            extractClosestEdge(self.data) === "top" ? state._id : (targets[targetIndex + 1]?._id ?? null);
          void onReorder({ stateId: moving._id, status, beforeStateId });
        },
      })
    );
  }, [canMove, groupStates.length, onReorder, state._id, states, status]);
  return (
    <>
      <DropIndicator isVisible={edge === "top"} />
      <div
        ref={elementRef}
        className={cn(
          "group relative rounded-sm border border-subtle bg-surface-1 px-3.5 py-3",
          dragging && "opacity-50",
          canMove && groupStates.length > 1 && "cursor-grab"
        )}
      >
        <StateItemTitle
          {...props}
          disabled={!canMove}
          stateCount={groupStates.length}
          percentage={(index + 1) / groupStates.length}
          onMoveUp={
            index > 0
              ? () => onReorder({ stateId: state._id, status, beforeStateId: groupStates[index - 1]._id })
              : undefined
          }
          onMoveDown={
            index < groupStates.length - 1
              ? () => onReorder({ stateId: state._id, status, beforeStateId: groupStates[index + 2]?._id ?? null })
              : undefined
          }
        />
      </div>
      <DropIndicator isVisible={edge === "bottom"} />
    </>
  );
}
