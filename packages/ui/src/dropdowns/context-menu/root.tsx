/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import React, { useEffect, useMemo, useRef, useState } from "react";
import { MenuPrimitive as Menu } from "@plane/propel/menu";
import { ContextMenuItem } from "./item";

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
  const [point, setPoint] = useState<{ x: number; y: number } | null>(null);
  useEffect(() => {
    const target = parentRef.current;
    if (!target) return;
    const openAtPointer = (event: MouseEvent) => {
      event.preventDefault();
      event.stopPropagation();
      originFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : target;
      setPoint({ x: event.clientX, y: event.clientY });
    };
    const openFromKeyboard = (event: KeyboardEvent) => {
      if (event.key !== "ContextMenu" && !(event.shiftKey && event.key === "F10")) return;
      event.preventDefault();
      event.stopPropagation();
      originFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : target;
      const rect = target.getBoundingClientRect();
      setPoint({ x: rect.left, y: rect.bottom });
    };
    target.addEventListener("contextmenu", openAtPointer);
    target.addEventListener("keydown", openFromKeyboard);
    return () => {
      target.removeEventListener("contextmenu", openAtPointer);
      target.removeEventListener("keydown", openFromKeyboard);
    };
  }, [parentRef]);
  const anchor = useMemo(
    () => ({ getBoundingClientRect: () => new DOMRect(point?.x ?? 0, point?.y ?? 0, 0, 0) }),
    [point]
  );
  return (
    <Menu.Root
      open={point !== null}
      onOpenChange={(open) => {
        if (!open) setPoint(null);
      }}
    >
      <Menu.Portal container={portalContainer}>
        <Menu.Positioner anchor={anchor} side="bottom" align="start" collisionPadding={8} className="z-[120]">
          <Menu.Popup
            finalFocus={originFocus}
            className="max-h-[min(24rem,var(--available-height))] min-w-48 overflow-y-auto rounded-md border border-subtle bg-surface-1 p-1 text-13 shadow-raised-200 outline-none"
          >
            {items.map((item) => (
              <ContextMenuItem key={item.key} item={item} />
            ))}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}
