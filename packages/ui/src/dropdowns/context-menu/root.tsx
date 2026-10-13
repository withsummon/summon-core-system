/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import React, { useEffect, useMemo, useRef, useState } from "react";
import { MenuPrimitive as Menu } from "@plane/propel/menu";
import { CONTEXT_MENU_POPUP_CLASSNAME, ContextMenuItem } from "./item";

export type TContextMenuItem = {
  key: string;
  customContent?: React.ReactNode;
  title?: string;
  description?: string;
  icon?: React.FC<any>;
  action: () => void;
  shouldRender?: boolean;
  closeOnClick?: boolean;
  disabled?: boolean;
  className?: string;
  iconClassName?: string;
  nestedMenuItems?: TContextMenuItem[];
};

type ContextMenuProps = {
  parentRef: React.RefObject<HTMLElement>;
  items: TContextMenuItem[];
  portalContainer?: HTMLElement | null;
};

// Detached row action components receive the target ref from the feature owner.
// Only opening at that target lives here; Base UI owns focus, dismissal and navigation.
export function ContextMenu({ parentRef, items, portalContainer }: ContextMenuProps) {
  const originFocus = useRef<HTMLElement | null>(null);
  // The point outlives `open` so the menu stays anchored while its exit animation plays.
  const [open, setOpen] = useState(false);
  const [point, setPoint] = useState({ x: 0, y: 0 });
  useEffect(() => {
    const target = parentRef.current;
    if (!target) return;
    const openAtPointer = (event: MouseEvent) => {
      event.preventDefault();
      event.stopPropagation();
      originFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : target;
      setPoint({ x: event.clientX, y: event.clientY });
      setOpen(true);
    };
    const openFromKeyboard = (event: KeyboardEvent) => {
      if (event.key !== "ContextMenu" && !(event.shiftKey && event.key === "F10")) return;
      event.preventDefault();
      event.stopPropagation();
      originFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : target;
      const rect = target.getBoundingClientRect();
      setPoint({ x: rect.left, y: rect.bottom });
      setOpen(true);
    };
    target.addEventListener("contextmenu", openAtPointer);
    target.addEventListener("keydown", openFromKeyboard);
    return () => {
      target.removeEventListener("contextmenu", openAtPointer);
      target.removeEventListener("keydown", openFromKeyboard);
    };
  }, [parentRef]);
  const anchor = useMemo(() => ({ getBoundingClientRect: () => new DOMRect(point.x, point.y, 0, 0) }), [point]);
  return (
    <Menu.Root open={open} onOpenChange={setOpen}>
      <Menu.Portal container={portalContainer}>
        <Menu.Positioner anchor={anchor} side="bottom" align="start" collisionPadding={8} className="z-[120]">
          <Menu.Popup finalFocus={originFocus} className={CONTEXT_MENU_POPUP_CLASSNAME}>
            {items.map((item) => (
              <ContextMenuItem key={item.key} item={item} />
            ))}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}
