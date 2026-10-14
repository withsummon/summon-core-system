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

/** The bottom sheet's surface. The dialog shares it, since it rises as a bottom sheet on a phone. */
export const BOTTOM_SHEET_CLASSNAME = "max-h-[85dvh] w-full rounded-t-2xl border-t pb-safe";

/** Sheet motion, timed by the open/close states Base UI sets on both drawer and dialog popups. */
export const SHEET_TRANSITION_CLASSNAME =
  "transition-[translate,opacity] duration-300 ease-spring-sheet data-[ending-style]:duration-[360ms] data-[ending-style]:ease-[cubic-bezier(0.45,0,0.55,1)]";

/** Side drawers fill the height; top and bottom sheets cap theirs. */
const popupEdge = {
  top: "max-h-[85dvh] w-full rounded-b-xl border-b",
  right: "h-full w-full max-w-lg border-l",
  bottom: BOTTOM_SHEET_CLASSNAME,
  left: "h-full w-full max-w-lg border-r",
} satisfies Record<TDrawerSide, string>;

/**
 * Base UI drawer: presence, focus, dismissal and swipe live in the primitive; this owner
 * adds the surface and motion. Enter is a snappy 300ms spring (response ≈ 0.22s) that answers
 * the click immediately; exit is a slower symmetric ease back to the same edge so the panel
 * leaves gracefully the way it came.
 */
const PHONE_QUERY = "(max-width: 767px)";

/** `"auto"`: a right-side drawer from md up, a bottom sheet on a phone. */
function useDrawerSide(side: TDrawerSide | "auto"): TDrawerSide {
  const isPhone = React.useSyncExternalStore(
    (onChange) => {
      if (side !== "auto") return () => {};
      const query = window.matchMedia(PHONE_QUERY);
      query.addEventListener("change", onChange);
      return () => query.removeEventListener("change", onChange);
    },
    () => side === "auto" && window.matchMedia(PHONE_QUERY).matches,
    () => false
  );
  if (side !== "auto") return side;
  return isPhone ? "bottom" : "right";
}

export function Drawer({
  side: sideProp = "right",
  swipeDirection: swipeDirectionProp,
  ...props
}: DrawerPrimitive.Root.Props & { side?: TDrawerSide | "auto" }) {
  const side = useDrawerSide(sideProp);
  const root = <DrawerPrimitive.Root swipeDirection={swipeDirectionProp ?? swipeDirection[side]} {...props} />;
  // Only a sheet that can rise from the bottom pushes the page back. A fixed-edge drawer reports to a provider of
  // its own that no `DrawerIndent` watches. Keyed on the prop, not the resolved side, so a resize never remounts it.
  const canIndent = sideProp === "bottom" || sideProp === "auto";
  return (
    <DrawerSideContext.Provider value={side}>
      {canIndent ? root : <DrawerPrimitive.Provider>{root}</DrawerPrimitive.Provider>}
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
  // A body-mounted drawer covers the app chrome (top bar z-27); dialogs (z-90+) and menus still stack above it.
  const layer = container ? "z-[25]" : "z-[80]";

  return (
    <DrawerPrimitive.Portal container={container}>
      {backdrop && (
        <DrawerPrimitive.Backdrop
          className={cn(
            position,
            layer,
            "inset-0 bg-backdrop opacity-0 transition-opacity duration-200 ease-out data-[ending-style]:opacity-0 data-[open]:opacity-100 data-[starting-style]:opacity-0 motion-reduce:transition-none"
          )}
        />
      )}
      <DrawerPrimitive.Viewport
        className={cn(position, layer, "pointer-events-none inset-0 flex", viewportAlign[side], viewportClassName)}
      >
        <DrawerPrimitive.Popup
          ref={ref}
          data-side={side}
          className={cn(
            "pointer-events-auto relative flex flex-col overflow-hidden border-subtle bg-surface-1 text-primary shadow-overlay-200 outline-none",
            SHEET_TRANSITION_CLASSNAME,
            "data-[swiping]:transition-none",
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
          {side === "bottom" && <SheetGrabber />}
          {children}
        </DrawerPrimitive.Popup>
      </DrawerPrimitive.Viewport>
    </DrawerPrimitive.Portal>
  );
});

/**
 * The grab pill on a bottom sheet. The whole sheet already follows a downward swipe; the pill says so. It is
 * a zero-height sticky row, so it stays pinned while the sheet scrolls and takes no room from the header.
 */
function SheetGrabber() {
  return (
    <div aria-hidden="true" className="pointer-events-none sticky top-0 z-20 h-0">
      <span className="absolute top-1.5 left-1/2 h-1 w-9 -translate-x-1/2 rounded-full bg-layer-3" />
    </div>
  );
}

/** Scopes the indent effect: bottom sheets opened under one provider push back the `DrawerIndent` beside them. */
export const DrawerProvider = DrawerPrimitive.Provider;

/**
 * The app's main UI. On a phone it recedes while a bottom sheet is open, so the sheet reads as a layer above
 * the page. Side drawers from md up leave it alone.
 */
export const DrawerIndent = React.forwardRef(function DrawerIndent(
  { className, ...props }: Omit<DrawerPrimitive.Indent.Props, "className"> & { className?: string },
  ref: React.ForwardedRef<HTMLDivElement>
) {
  return (
    <DrawerPrimitive.Indent
      ref={ref}
      className={cn(
        "origin-top motion-reduce:transition-none max-md:transition-[scale,translate,border-radius] max-md:duration-[400ms] max-md:ease-[cubic-bezier(0.32,0.72,0,1)]",
        "max-md:data-[active]:translate-y-[calc(0.5rem+env(safe-area-inset-top,0px))] max-md:data-[active]:scale-[0.94] max-md:data-[active]:overflow-hidden max-md:data-[active]:rounded-t-2xl",
        "motion-reduce:data-[active]:translate-y-0! motion-reduce:data-[active]:scale-100!",
        className
      )}
      {...props}
    />
  );
});

/** The dark backdrop the indented page recedes onto. */
export function DrawerIndentBackground() {
  return <DrawerPrimitive.IndentBackground className="fixed inset-0 bg-black md:hidden" />;
}

export const DrawerTitle = DrawerPrimitive.Title;
export const DrawerDescription = DrawerPrimitive.Description;
export const DrawerClose = DrawerPrimitive.Close;
export type TDrawerChangeEventDetails = DrawerPrimitive.Root.ChangeEventDetails;
