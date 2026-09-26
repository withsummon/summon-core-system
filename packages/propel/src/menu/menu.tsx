/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import * as React from "react";
import { Menu as BaseMenu } from "@base-ui-components/react/menu";
import { MoreHorizontal } from "lucide-react";
import { ChevronDownIcon, ChevronRightIcon } from "../icons";
import { cn } from "../utils/classname";
import { convertPlacementToSideAndAlign } from "../utils/placement";
import type { TMenuProps, TSubMenuProps, TMenuItemProps } from "./types";

const popupClassName =
  "min-w-48 overflow-y-auto rounded-md border border-subtle bg-surface-1 p-1 text-13 text-primary shadow-raised-200 outline-none origin-[var(--transform-origin)] transition-[opacity,scale] duration-150 data-[starting-style]:scale-[0.98] data-[starting-style]:opacity-0 data-[ending-style]:opacity-0 motion-reduce:transition-none";
const itemClassName =
  "flex w-full cursor-default items-center gap-2 rounded px-2 py-1.5 text-left outline-none select-none data-[highlighted]:bg-layer-1 data-[disabled]:text-placeholder data-[disabled]:opacity-50";
const SelectionContext = React.createContext<boolean | undefined>(undefined);

function MenuItem({ children, disabled, onClick, className }: TMenuItemProps) {
  const closeOnSelect = React.useContext(SelectionContext);
  return (
    <BaseMenu.Item
      disabled={disabled}
      closeOnClick={closeOnSelect}
      className={cn(itemClassName, className)}
      nativeButton
      render={<button type="button" onClick={onClick} />}
    >
      {children}
    </BaseMenu.Item>
  );
}

function SubMenu({
  children,
  trigger,
  disabled,
  className,
  contentClassName,
  placement = "right-start",
}: TSubMenuProps) {
  const { side, align } = convertPlacementToSideAndAlign(placement);
  return (
    <BaseMenu.SubmenuRoot disabled={disabled}>
      <BaseMenu.SubmenuTrigger className={cn(itemClassName, className)}>
        <span className="min-w-0 flex-1">{trigger}</span>
        <ChevronRightIcon className="size-3.5" />
      </BaseMenu.SubmenuTrigger>
      <BaseMenu.Portal>
        <BaseMenu.Positioner side={side} align={align} sideOffset={4} className="z-[130]">
          <BaseMenu.Popup className={cn(popupClassName, contentClassName)}>{children}</BaseMenu.Popup>
        </BaseMenu.Positioner>
      </BaseMenu.Portal>
    </BaseMenu.SubmenuRoot>
  );
}

function Menu({
  ariaLabel,
  buttonClassName,
  customButtonClassName,
  customButtonTabIndex = 0,
  children,
  customButton,
  render,
  disabled = false,
  ellipsis = false,
  label,
  maxHeight = "md",
  noBorder = false,
  noChevron = false,
  optionsClassName,
  menuItemsClassName,
  verticalEllipsis = false,
  menuButtonOnClick,
  onMenuClose,
  onOpen,
  tabIndex,
  openOnHover = false,
  handleOpenChange,
  className,
  placement = "bottom-start",
  portalElement,
  closeOnSelect,
}: TMenuProps) {
  const { side, align } = convertPlacementToSideAndAlign(placement);
  return (
    <BaseMenu.Root
      openOnHover={openOnHover}
      onOpenChange={(open) => {
        handleOpenChange?.(open);
        if (open) onOpen?.();
        else onMenuClose?.();
      }}
    >
      <div className={cn("relative w-min text-left", className)}>
        <BaseMenu.Trigger
          render={render}
          disabled={disabled}
          aria-label={ariaLabel ?? (ellipsis || verticalEllipsis ? "More options" : undefined)}
          tabIndex={customButtonTabIndex}
          onClick={(event) => {
            event.stopPropagation();
            menuButtonOnClick?.();
          }}
          className={cn(
            "flex items-center justify-between gap-1 rounded whitespace-nowrap transition-colors outline-none focus-visible:ring-2 focus-visible:ring-accent-strong/40 disabled:cursor-not-allowed disabled:opacity-50",
            render || customButton
              ? customButtonClassName
              : [
                  ellipsis || verticalEllipsis
                    ? "p-1 text-secondary hover:bg-layer-1"
                    : "px-2.5 py-1 text-11 text-secondary hover:bg-layer-1",
                  !noBorder && !ellipsis && !verticalEllipsis && "border border-strong",
                  buttonClassName,
                ]
          )}
        >
          {render
            ? undefined
            : (customButton ??
              (ellipsis || verticalEllipsis ? (
                <MoreHorizontal className={cn("size-3.5", verticalEllipsis && "rotate-90")} />
              ) : (
                <>
                  {label}
                  {!noChevron && <ChevronDownIcon className="size-3.5" />}
                </>
              )))}
        </BaseMenu.Trigger>
      </div>
      <BaseMenu.Portal container={portalElement}>
        <BaseMenu.Positioner side={side} align={align} sideOffset={4} className={cn("z-[120]", menuItemsClassName)}>
          <BaseMenu.Popup
            tabIndex={tabIndex}
            onClick={(event) => event.stopPropagation()}
            className={cn(
              popupClassName,
              {
                "max-h-28": maxHeight === "sm",
                "max-h-36": maxHeight === "rg",
                "max-h-48": maxHeight === "md",
                "max-h-60": maxHeight === "lg",
                "max-h-80": maxHeight === "xl",
                "max-h-96": maxHeight === "2xl",
              },
              optionsClassName
            )}
          >
            <SelectionContext.Provider value={closeOnSelect}>{children}</SelectionContext.Provider>
          </BaseMenu.Popup>
        </BaseMenu.Positioner>
      </BaseMenu.Portal>
    </BaseMenu.Root>
  );
}
Menu.MenuItem = MenuItem;
Menu.SubMenu = SubMenu;
export { Menu };
export { Menu as MenuPrimitive } from "@base-ui-components/react/menu";
