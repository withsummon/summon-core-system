/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */
import type { ReactNode } from "react";
import { useTranslation } from "@plane/i18n";
import { ContextMenu } from "@plane/propel/context-menu";
import { Menu } from "@plane/propel/menu";
import type { TContextMenuItem } from "@plane/ui";
import { cn } from "@plane/utils";

export function WorkspaceDraftIssueQuickActions({
  MENU_ITEMS,
  renderRow,
}: {
  MENU_ITEMS: (TContextMenuItem & { title: string })[];
  renderRow: (menu: ReactNode) => ReactNode;
}) {
  const { t } = useTranslation();
  const items = (Item: typeof Menu.MenuItem | typeof ContextMenu.Item) =>
    MENU_ITEMS.map((item) => (
      <Item
        key={item.key}
        onClick={item.action}
        disabled={item.disabled}
        className={cn("flex items-center gap-2", item.className)}
      >
        {item.icon && <item.icon className={cn("size-3", item.iconClassName)} />}
        {t(item.title)}
      </Item>
    ));
  const menu = (
    <Menu ellipsis placement="bottom-end" ariaLabel="Draft actions">
      {items(Menu.MenuItem)}
    </Menu>
  );
  return (
    <ContextMenu>
      <ContextMenu.Trigger className="contents">{renderRow(menu)}</ContextMenu.Trigger>
      <ContextMenu.Portal>
        <ContextMenu.Content positionerClassName="z-[120]">{items(ContextMenu.Item)}</ContextMenu.Content>
      </ContextMenu.Portal>
    </ContextMenu>
  );
}
