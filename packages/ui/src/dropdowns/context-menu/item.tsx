/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { MenuPrimitive as Menu } from "@plane/propel/menu";
import { ChevronRightIcon } from "@plane/propel/icons";
import { POPUP_CLASSNAME, POPUP_OPTION_CLASSNAME } from "@plane/propel/popover";
import { cn } from "../../utils";
import type { TContextMenuItem } from "./root";

export const CONTEXT_MENU_POPUP_CLASSNAME = cn(
  "max-h-[min(24rem,var(--available-height))] min-w-48 overflow-y-auto",
  POPUP_CLASSNAME
);

export function ContextMenuItem({ item }: { item: TContextMenuItem }) {
  if (item.shouldRender === false) return null;
  const className = cn(POPUP_OPTION_CLASSNAME, item.className);
  const content = item.customContent ?? (
    <>
      {item.icon && <item.icon className={cn("size-3.5", item.iconClassName)} />}
      <span className="min-w-0 flex-1">
        <span className="block">{item.title}</span>
        {item.description && <span className="block whitespace-pre-line text-tertiary">{item.description}</span>}
      </span>
    </>
  );
  const nested = item.nestedMenuItems?.filter((child) => child.shouldRender !== false);
  if (nested?.length)
    return (
      <Menu.SubmenuRoot disabled={item.disabled}>
        <Menu.SubmenuTrigger className={className}>
          {content}
          <ChevronRightIcon className="size-3.5" />
        </Menu.SubmenuTrigger>
        <Menu.Portal>
          <Menu.Positioner side="right" align="start" sideOffset={4} collisionPadding={8} className="z-[130]">
            <Menu.Popup className={CONTEXT_MENU_POPUP_CLASSNAME}>
              {nested.map((child) => (
                <ContextMenuItem key={child.key} item={child} />
              ))}
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.SubmenuRoot>
    );
  return (
    <Menu.Item
      disabled={item.disabled}
      closeOnClick={item.closeOnClick}
      onClick={() => item.action()}
      className={className}
    >
      {content}
    </Menu.Item>
  );
}
