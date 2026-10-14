/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { TContextMenuItem } from "@plane/ui";
import { CustomMenu } from "@plane/ui";
import { cn } from "@plane/utils";

function MenuItemDescription(props: { item: TContextMenuItem }) {
  const { item } = props;
  if (!item.description) return null;
  return (
    <p className={cn("whitespace-pre-line text-tertiary", { "text-placeholder": item.disabled })}>{item.description}</p>
  );
}

function MenuItemIcon(props: { item: TContextMenuItem }) {
  const { item } = props;
  if (!item.icon) return null;
  return <item.icon className={cn("h-3 w-3", item.iconClassName)} />;
}

function QuickActionMenuItem(props: { item: TContextMenuItem }) {
  const { item } = props;
  return (
    <CustomMenu.MenuItem
      onClick={() => {
        item.action();
      }}
      className={cn("flex items-center gap-2", { "text-placeholder": item.disabled }, item.className)}
      disabled={item.disabled}
    >
      <MenuItemIcon item={item} />
      <div>
        <h5>{item.title}</h5>
        <MenuItemDescription item={item} />
      </div>
    </CustomMenu.MenuItem>
  );
}

type Props = {
  items: TContextMenuItem[];
};

/** Renders work item quick actions inside a `CustomMenu`, with a submenu for items that have nested actions. */
export function QuickActionMenuItems(props: Props) {
  const { items } = props;

  return (
    <>
      {items.map((item) => {
        if (item.shouldRender === false) return null;

        if (!item.nestedMenuItems?.length) return <QuickActionMenuItem key={item.key} item={item} />;

        return (
          <CustomMenu.SubMenu
            key={item.key}
            trigger={
              <div className="flex items-center gap-2">
                <MenuItemIcon item={item} />
                <h5>{item.title}</h5>
                <MenuItemDescription item={item} />
              </div>
            }
            disabled={item.disabled}
            className={cn("flex items-center gap-2", { "text-placeholder": item.disabled }, item.className)}
          >
            {item.nestedMenuItems.map((nestedItem) => (
              <QuickActionMenuItem key={nestedItem.key} item={nestedItem} />
            ))}
          </CustomMenu.SubMenu>
        );
      })}
    </>
  );
}
