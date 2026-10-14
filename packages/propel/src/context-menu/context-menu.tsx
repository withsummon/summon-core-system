/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import * as React from "react";
import { ContextMenu as ContextMenuPrimitive } from "@base-ui/react/context-menu";
import { POPUP_CLASSNAME, POPUP_OPTION_CLASSNAME } from "../popover/surface";
import { cn } from "../utils";

export interface ContextMenuProps extends React.ComponentProps<typeof ContextMenuPrimitive.Root> {
  children: React.ReactNode;
}

export interface ContextMenuTriggerProps extends React.ComponentProps<typeof ContextMenuPrimitive.Trigger> {
  children: React.ReactNode;
  className?: string;
}

export interface ContextMenuContentProps extends React.ComponentProps<typeof ContextMenuPrimitive.Positioner> {
  children: React.ReactNode;
  className?: string;
  side?: "top" | "right" | "bottom" | "left";
  sideOffset?: number;
  positionerClassName?: string;
}

export interface ContextMenuItemProps extends React.ComponentProps<typeof ContextMenuPrimitive.Item> {
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
}

const ContextMenuRoot = React.forwardRef(function ContextMenuRoot(
  { children, ...props }: ContextMenuProps,
  _ref: React.ForwardedRef<React.ElementRef<typeof ContextMenuPrimitive.Root>>
) {
  return <ContextMenuPrimitive.Root {...props}>{children}</ContextMenuPrimitive.Root>;
});

const ContextMenuTrigger = React.forwardRef(function ContextMenuTrigger(
  { className, children, ...props }: ContextMenuTriggerProps,
  ref: React.ForwardedRef<React.ElementRef<typeof ContextMenuPrimitive.Trigger>>
) {
  return (
    <ContextMenuPrimitive.Trigger ref={ref} className={cn("outline-none", className)} {...props}>
      {children}
    </ContextMenuPrimitive.Trigger>
  );
});

const ContextMenuPortal = ContextMenuPrimitive.Portal;

const ContextMenuContent = React.forwardRef(function ContextMenuContent(
  { positionerClassName, className, children, side = "bottom", sideOffset = 4, ...props }: ContextMenuContentProps,
  ref: React.ForwardedRef<React.ElementRef<typeof ContextMenuPrimitive.Positioner>>
) {
  return (
    <ContextMenuPrimitive.Positioner
      ref={ref}
      side={side}
      sideOffset={sideOffset}
      {...props}
      className={positionerClassName}
    >
      <ContextMenuPrimitive.Popup className={cn("z-50 min-w-32 overflow-hidden", POPUP_CLASSNAME, className)}>
        {children}
      </ContextMenuPrimitive.Popup>
    </ContextMenuPrimitive.Positioner>
  );
});

const ContextMenuItem = React.forwardRef(function ContextMenuItem(
  { className, disabled, children, ...props }: ContextMenuItemProps,
  ref: React.ForwardedRef<React.ElementRef<typeof ContextMenuPrimitive.Item>>
) {
  return (
    <ContextMenuPrimitive.Item
      ref={ref}
      className={cn(POPUP_OPTION_CLASSNAME, "relative text-primary", className)}
      disabled={disabled}
      {...props}
    >
      {children}
    </ContextMenuPrimitive.Item>
  );
});

const ContextMenuSeparator = React.forwardRef(function ContextMenuSeparator(
  { className, ...props }: React.ComponentProps<typeof ContextMenuPrimitive.Separator>,
  ref: React.ForwardedRef<React.ElementRef<typeof ContextMenuPrimitive.Separator>>
) {
  return (
    <ContextMenuPrimitive.Separator
      ref={ref}
      className={cn("-mx-1 my-1 h-px bg-(--border-color-subtle-1)", className)}
      {...props}
    />
  );
});

const ContextMenuSubmenu = ContextMenuPrimitive.SubmenuRoot;

const ContextMenuSubmenuTrigger = React.forwardRef(function ContextMenuSubmenuTrigger(
  { className, children, ...props }: React.ComponentProps<typeof ContextMenuPrimitive.SubmenuTrigger>,
  ref: React.ForwardedRef<React.ElementRef<typeof ContextMenuPrimitive.SubmenuTrigger>>
) {
  return (
    <ContextMenuPrimitive.SubmenuTrigger
      ref={ref}
      className={cn(
        "flex cursor-default items-center rounded-md px-2 py-1.5 text-13 outline-none select-none",
        "data-[highlighted]:bg-layer-1 data-[popup-open]:bg-layer-1",
        className
      )}
      {...props}
    >
      {children}
    </ContextMenuPrimitive.SubmenuTrigger>
  );
});

ContextMenuRoot.displayName = "ContextMenu";
ContextMenuTrigger.displayName = "ContextMenuTrigger";
ContextMenuContent.displayName = "ContextMenuContent";
ContextMenuItem.displayName = "ContextMenuItem";
ContextMenuSeparator.displayName = "ContextMenuSeparator";
ContextMenuSubmenuTrigger.displayName = "ContextMenuSubmenuTrigger";

// compound components
const ContextMenu = Object.assign(ContextMenuRoot, {
  Trigger: ContextMenuTrigger,
  Portal: ContextMenuPortal,
  Content: ContextMenuContent,
  Item: ContextMenuItem,
  Separator: ContextMenuSeparator,
  Submenu: ContextMenuSubmenu,
  SubmenuTrigger: ContextMenuSubmenuTrigger,
});

export { ContextMenu };
