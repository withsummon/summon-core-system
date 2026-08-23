/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import { Ellipsis } from "lucide-react";
import { useParams } from "next/navigation";
// plane imports
import {
  EUserPermissions,
  EUserPermissionsLevel,
  SUMMON_ASSISTANT_NAVIGATION_ITEM,
  SUMMON_WORKSPACE_NAVIGATION_ITEMS,
} from "@plane/constants";
// components
import { SidebarNavItem } from "@/components/sidebar/sidebar-navigation";
// store hooks
import { useAppTheme } from "@/hooks/store/use-app-theme";
import { useUserPermissions } from "@/hooks/store/user";
import { SidebarItemBase } from "./sidebar-item";

const summonNavigationItemKeys = SUMMON_WORKSPACE_NAVIGATION_ITEMS.map(({ key }) => key);

export const SidebarMenuItems = observer(function SidebarMenuItems() {
  const { workspaceSlug } = useParams();
  const { isExtendedSidebarOpened, toggleExtendedSidebar } = useAppTheme();
  const { allowPermissions } = useUserPermissions();
  const isWorkspaceAdmin = allowPermissions(
    [EUserPermissions.ADMIN],
    EUserPermissionsLevel.WORKSPACE,
    workspaceSlug?.toString()
  );

  return (
    <div className="flex min-h-full flex-col">
      <div className="flex flex-col gap-0.5">
        {SUMMON_WORKSPACE_NAVIGATION_ITEMS.map((item) => (
          <SidebarItemBase key={item.key} item={item} additionalStaticItems={summonNavigationItemKeys} />
        ))}
        {isWorkspaceAdmin && (
          <SidebarNavItem>
            <button
              type="button"
              onClick={() => toggleExtendedSidebar()}
              className="flex flex-grow items-center gap-1.5 py-px text-13 font-medium text-tertiary"
              id="extended-sidebar-toggle"
              aria-label={`${isExtendedSidebarOpened ? "Close" : "Open"} Advanced Plane`}
            >
              <Ellipsis className="size-4 flex-shrink-0" />
              <span>Advanced Plane</span>
            </button>
          </SidebarNavItem>
        )}
      </div>
      <div className="mt-auto border-t border-subtle pt-2">
        <SidebarItemBase
          item={SUMMON_ASSISTANT_NAVIGATION_ITEM}
          additionalStaticItems={[...summonNavigationItemKeys, SUMMON_ASSISTANT_NAVIGATION_ITEM.key]}
        />
      </div>
    </div>
  );
});
