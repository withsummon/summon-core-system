import { useEffect, useRef } from "react";
import { combine } from "@atlaskit/pragmatic-drag-and-drop/combine";
import { draggable, dropTargetForElements } from "@atlaskit/pragmatic-drag-and-drop/element/adapter";
import type { Doc } from "@summon/convex/data-model";
import { StickyGridItem } from "../layout/grid";
import { useNativeStickies } from "./provider";
export function NativeStickyDraggable({
  row,
  itemWidth,
  children,
}: {
  row: Doc<"stickies">;
  itemWidth: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const { move, setError } = useNativeStickies();
  useEffect(() => {
    if (!ref.current) return;
    const element = ref.current;
    return combine(
      draggable({ element, getInitialData: () => ({ type: "native-sticky", id: row._id }) }),
      dropTargetForElements({
        element,
        canDrop: ({ source }) => source.data.type === "native-sticky" && source.data.id !== row._id,
        onDrop: ({ source, location }) => {
          if (typeof source.data.id !== "string") return;
          const midpoint = element.getBoundingClientRect().top + element.offsetHeight / 2;
          void move(source.data.id, row._id, location.current.input.clientY < midpoint ? "before" : "after").catch(
            (cause) => setError(cause instanceof Error ? cause.message : "Unable to move sticky.")
          );
        },
      })
    );
  }, [row._id, move, setError]);
  return (
    <StickyGridItem ref={ref} width={itemWidth}>
      {children}
    </StickyGridItem>
  );
}
