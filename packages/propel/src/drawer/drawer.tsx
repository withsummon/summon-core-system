/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import * as React from "react";
import { Drawer as DrawerPrimitive } from "@base-ui/react/drawer";
import { cn } from "../utils/classname";

export type TDrawerSide = "top" | "right" | "bottom" | "left";

const DrawerSideContext = React.createContext<TDrawerSide>("right");

const swipeDirection = {
  top: "up",
  right: "right",
  bottom: "down",
  left: "left",
} satisfies Record<TDrawerSide, "up" | "right" | "down" | "left">;

const viewportAlign = {
  top: "items-start justify-center",
  right: "justify-end",
  bottom: "items-end justify-center",
  left: "justify-start",
} satisfies Record<TDrawerSide, string>;

/** Side drawers fill the height; top and bottom sheets cap theirs. */
const popupEdge = {
  top: "max-h-[85dvh] w-full rounded-b-xl border-b",
  right: "h-full w-full max-w-lg border-l",
  bottom: "max-h-[85dvh] w-full rounded-t-xl border-t",
  left: "h-full w-full max-w-lg border-r",
} satisfies Record<TDrawerSide, string>;

/**
 * Base UI drawer: presence, focus, dismissal and swipe live in the primitive; this owner
 * adds the surface and motion. Enter is a snappy 300ms spring (response ≈ 0.22s) that answers
 * the click immediately; exit is a slower symmetric ease back to the same edge so the panel
 * leaves gracefully the way it came.
 */
export function Drawer({
  side = "right",
  swipeDirection: swipeDirectionProp,
  ...props
}: DrawerPrimitive.Root.Props & { side?: TDrawerSide }) {
  return (
    <DrawerSideContext.Provider value={side}>
      <DrawerPrimitive.Root swipeDirection={swipeDirectionProp ?? swipeDirection[side]} {...props} />
    </DrawerSideContext.Provider>
  );
}

export type DrawerContentProps = DrawerPrimitive.Popup.Props & {
  /** Mount inside this element instead of the document body; the drawer then covers only that region. */
  container?: DrawerPrimitive.Portal.Props["container"];
  backdrop?: boolean;
  viewportClassName?: string;
};

export const DrawerContent = React.forwardRef(function DrawerContent(
  { className, children, container, backdrop = false, viewportClassName, ...props }: DrawerContentProps,
  ref: React.ForwardedRef<HTMLDivElement>
) {
  const side = React.useContext(DrawerSideContext);
  const position = container ? "absolute" : "fixed";

  return (
    <DrawerPrimitive.Portal container={container}>
      {backdrop && (
        <DrawerPrimitive.Backdrop
          className={cn(
            position,
            "inset-0 z-[25] bg-backdrop opacity-0 transition-opacity duration-200 ease-out data-[ending-style]:opacity-0 data-[open]:opacity-100 data-[starting-style]:opacity-0 motion-reduce:transition-none"
          )}
        />
      )}
      <DrawerPrimitive.Viewport
        className={cn(position, "pointer-events-none inset-0 z-[25] flex", viewportAlign[side], viewportClassName)}
      >
        <DrawerPrimitive.Popup
          ref={ref}
          data-side={side}
          className={cn(
            "pointer-events-auto relative flex flex-col overflow-hidden border-subtle bg-surface-1 text-primary shadow-overlay-200 outline-none",
            "transition-[translate,opacity] duration-300 ease-spring-sheet data-[ending-style]:duration-[360ms] data-[ending-style]:ease-[cubic-bezier(0.45,0,0.55,1)] data-[swiping]:transition-none",
            "data-[swipe-direction=left]:translate-x-(--drawer-swipe-movement-x) data-[swipe-direction=right]:translate-x-(--drawer-swipe-movement-x)",
            "data-[swipe-direction=down]:translate-y-(--drawer-swipe-movement-y) data-[swipe-direction=up]:translate-y-(--drawer-swipe-movement-y)",
            "data-[swipe-direction=right]:data-[ending-style]:translate-x-full data-[swipe-direction=right]:data-[starting-style]:translate-x-full",
            "data-[swipe-direction=left]:data-[ending-style]:-translate-x-full data-[swipe-direction=left]:data-[starting-style]:-translate-x-full",
            "data-[swipe-direction=down]:data-[ending-style]:translate-y-full data-[swipe-direction=down]:data-[starting-style]:translate-y-full",
            "data-[swipe-direction=up]:data-[ending-style]:-translate-y-full data-[swipe-direction=up]:data-[starting-style]:-translate-y-full",
            "motion-reduce:translate-x-0! motion-reduce:translate-y-0! motion-reduce:transition-opacity motion-reduce:data-[ending-style]:opacity-0 motion-reduce:data-[starting-style]:opacity-0",
            popupEdge[side],
            className
          )}
          {...props}
        >
          {children}
        </DrawerPrimitive.Popup>
      </DrawerPrimitive.Viewport>
    </DrawerPrimitive.Portal>
  );
});

export const DrawerTitle = DrawerPrimitive.Title;
export const DrawerDescription = DrawerPrimitive.Description;
export const DrawerClose = DrawerPrimitive.Close;
export type TDrawerChangeEventDetails = DrawerPrimitive.Root.ChangeEventDetails;
