/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { ReactNode } from "react";
import { Check, ChevronRight } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { MENU_ITEM_CLASSNAME, MENU_POPUP_CLASSNAME, MenuPrimitive as Menu } from "@plane/propel/menu";
import { cn } from "@plane/utils";

export type TOption = { id: string; label: string };

export const OPTION_POPUP_CLASSNAME = cn(MENU_POPUP_CLASSNAME, "max-h-[min(22rem,var(--available-height))] w-64");
const SEARCH_CLASSNAME =
  "mb-1 w-full border-b border-subtle bg-transparent px-2 pt-1 pb-2 text-13 text-primary outline-none placeholder:text-placeholder";

/** A submenu row that opens an option list; long lists get a filter field. */
export function OptionSubmenu(props: {
  icon: LucideIcon;
  label: string;
  options: TOption[];
  trailing: ReactNode;
  isChecked: (id: string) => boolean;
  onPick: (id: string) => void;
  multiple?: boolean;
}) {
  const { icon: Icon } = props;
  const submenu = (
    <Menu.SubmenuRoot>
      <Menu.SubmenuTrigger label={props.label} className={MENU_ITEM_CLASSNAME} disabled={!props.options.length}>
        <Icon aria-hidden className="size-4 text-secondary" />
        <span className="flex-1">{props.label}</span>
        {props.trailing}
        <ChevronRight aria-hidden className="size-3.5 text-tertiary" />
      </Menu.SubmenuTrigger>
      <Menu.Portal>
        <Menu.Positioner side="right" align="start" sideOffset={4} className="z-[130]">
          <OptionPopup {...props} />
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.SubmenuRoot>
  );
  return isSearchable(props.options) ? <Menu.FilterProvider autoHighlight>{submenu}</Menu.FilterProvider> : submenu;
}

/** Long option lists get a filter field; wrap the menu root in `Menu.FilterProvider` when this is true. */
export const isSearchable = (options: TOption[]) => options.length > 6;

/** One option list for a menu: plain items, or check items with `multiple`. */
export function OptionPopup(props: {
  label: string;
  options: TOption[];
  isChecked: (id: string) => boolean;
  onPick: (id: string) => void;
  multiple?: boolean;
}) {
  const items = props.options.map((option) =>
    props.multiple ? (
      <Menu.CheckboxItem
        key={option.id}
        label={option.label}
        checked={props.isChecked(option.id)}
        onCheckedChange={() => props.onPick(option.id)}
        className={MENU_ITEM_CLASSNAME}
      >
        <span className="min-w-0 flex-1 truncate">{option.label}</span>
        <Menu.CheckboxItemIndicator className="flex-none text-accent-primary">
          <Check aria-hidden className="size-4" />
        </Menu.CheckboxItemIndicator>
      </Menu.CheckboxItem>
    ) : (
      <Menu.Item
        key={option.id}
        label={option.label}
        onClick={() => props.onPick(option.id)}
        className={MENU_ITEM_CLASSNAME}
      >
        <span className="min-w-0 flex-1 truncate">{option.label}</span>
        {props.isChecked(option.id) ? <Check aria-hidden className="size-4 flex-none text-accent-primary" /> : null}
      </Menu.Item>
    )
  );
  return (
    <Menu.Popup className={OPTION_POPUP_CLASSNAME}>
      {isSearchable(props.options) ? (
        <>
          <Menu.Input
            aria-label={`Find ${props.label.toLowerCase()}`}
            placeholder={`${props.label}…`}
            className={SEARCH_CLASSNAME}
          />
          <Menu.List>{items}</Menu.List>
          <Menu.Empty className="px-2 py-1.5 text-13 text-placeholder">No matches</Menu.Empty>
        </>
      ) : (
        items
      )}
    </Menu.Popup>
  );
}
