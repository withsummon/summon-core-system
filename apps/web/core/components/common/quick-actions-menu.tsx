/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { MoreHorizontal } from "lucide-react";
// plane imports
import { IconButton } from "@plane/propel/icon-button";
import type { TContextMenuItem } from "@plane/ui";
import { CustomMenu } from "@plane/ui";
import { cn } from "@plane/utils";

type Props = {
  items: TContextMenuItem[];
  customClassName?: string;
  /** Base classes for each item's icon; merged with the item's own `iconClassName`. */
  iconClassName?: string;
};

/** The "more" (…) dropdown that lists an entity's quick actions. */
export function QuickActionsMenu(props: Props) {
  const { items, customClassName, iconClassName = "h-3 w-3" } = props;

  return (
    <CustomMenu
      render={<IconButton variant="tertiary" size="lg" icon={MoreHorizontal} />}
      placement="bottom-end"
      closeOnSelect
      buttonClassName={customClassName}
    >
      {items.map((item) => {
        if (item.shouldRender === false) return null;
        return (
          <CustomMenu.MenuItem
            key={item.key}
            onClick={() => {
              item.action();
            }}
            className={cn(
              "flex items-center gap-2",
              {
                "text-placeholder": item.disabled,
              },
              item.className
            )}
            disabled={item.disabled}
          >
            {item.icon && <item.icon className={cn(iconClassName, item.iconClassName)} />}
            <div>
              <h5>{item.title}</h5>
              {item.description && (
                <p
                  className={cn("whitespace-pre-line text-tertiary", {
                    "text-placeholder": item.disabled,
                  })}
                >
                  {item.description}
                </p>
              )}
            </div>
          </CustomMenu.MenuItem>
        );
      })}
    </CustomMenu>
  );
}
