/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import * as React from "react";
import { Menu as BaseMenu } from "@base-ui/react/menu";
import { MoreHorizontal } from "lucide-react";
import { ChevronDownIcon, ChevronRightIcon } from "../icons";
import { cn } from "../utils/classname";
import { convertPlacementToSideAndAlign } from "../utils/placement";
import { MENU_ITEM_CLASSNAME, MENU_POPUP_CLASSNAME } from "./constants";
import type { TMenuProps, TSubMenuProps, TMenuItemProps } from "./types";

const SelectionContext = React.createContext<boolean | undefined>(undefined);

function MenuItem({ children, disabled, onClick, className }: TMenuItemProps) {
  const closeOnSelect = React.useContext(SelectionContext);
  return (
    <BaseMenu.Item
      disabled={disabled}
      closeOnClick={closeOnSelect}
      className={cn(MENU_ITEM_CLASSNAME, className)}
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
      <BaseMenu.SubmenuTrigger className={cn(MENU_ITEM_CLASSNAME, className)}>
        <span className="min-w-0 flex-1">{trigger}</span>
        <ChevronRightIcon className="size-3.5" />
      </BaseMenu.SubmenuTrigger>
      <BaseMenu.Portal>
        <BaseMenu.Positioner side={side} align={align} sideOffset={4} className="z-[130]">
          <BaseMenu.Popup className={cn(MENU_POPUP_CLASSNAME, contentClassName)}>{children}</BaseMenu.Popup>
        </BaseMenu.Positioner>
      </BaseMenu.Portal>
    </BaseMenu.SubmenuRoot>
  );
}

const MAX_HEIGHT_CLASSNAME: Record<NonNullable<TMenuProps["maxHeight"]>, string> = {
  sm: "max-h-28",
  rg: "max-h-36",
  md: "max-h-48",
  lg: "max-h-60",
  xl: "max-h-80",
  "2xl": "max-h-96",
};

type TMenuTriggerContentProps = Pick<TMenuProps, "customButton" | "label" | "noChevron"> & {
  isEllipsis: boolean;
  verticalEllipsis: boolean;
};

function MenuTriggerContent({
  customButton,
  label,
  noChevron,
  isEllipsis,
  verticalEllipsis,
}: TMenuTriggerContentProps) {
  if (customButton !== undefined && customButton !== null) return <>{customButton}</>;
  if (isEllipsis) return <MoreHorizontal className={cn("size-3.5", verticalEllipsis && "rotate-90")} />;
  return (
    <>
      {label}
      {!noChevron && <ChevronDownIcon className="size-3.5" />}
    </>
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
  const isEllipsis = ellipsis || verticalEllipsis;
  const triggerClassName =
    render || customButton
      ? customButtonClassName
      : [
          isEllipsis ? "p-1 text-secondary hover:bg-layer-1" : "px-2.5 py-1 text-11 text-secondary hover:bg-layer-1",
          !noBorder && !isEllipsis && "border border-strong",
          buttonClassName,
        ];
  return (
    <BaseMenu.Root
      onOpenChange={(open) => {
        handleOpenChange?.(open);
        if (open) onOpen?.();
        else onMenuClose?.();
      }}
    >
      <div className={cn("relative w-min text-left", className)}>
        <BaseMenu.Trigger
          openOnHover={openOnHover}
          render={render}
          disabled={disabled}
          aria-label={ariaLabel ?? (isEllipsis ? "More options" : undefined)}
          tabIndex={customButtonTabIndex}
          onClick={(event) => {
            event.stopPropagation();
            menuButtonOnClick?.();
          }}
          className={cn(
            // A `render` element owns its own layout and focus styles.
            !render &&
              "flex items-center justify-between gap-1 rounded whitespace-nowrap transition-colors outline-none focus-visible:ring-2 focus-visible:ring-accent-strong/40 disabled:cursor-not-allowed disabled:opacity-50",
            triggerClassName
          )}
        >
          {render ? undefined : (
            <MenuTriggerContent
              customButton={customButton}
              label={label}
              noChevron={noChevron}
              isEllipsis={isEllipsis}
              verticalEllipsis={verticalEllipsis}
            />
          )}
        </BaseMenu.Trigger>
      </div>
      <BaseMenu.Portal container={portalElement}>
        <BaseMenu.Positioner side={side} align={align} sideOffset={4} className={cn("z-[120]", menuItemsClassName)}>
          <BaseMenu.Popup
            tabIndex={tabIndex}
            onClick={(event) => event.stopPropagation()}
            className={cn(MENU_POPUP_CLASSNAME, MAX_HEIGHT_CLASSNAME[maxHeight], optionsClassName)}
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
export { Menu as MenuPrimitive } from "@base-ui/react/menu";
