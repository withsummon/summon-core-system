/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { Fragment } from "react";
import { observer } from "mobx-react";
import { Ellipsis } from "lucide-react";
import { useParams, usePathname } from "next/navigation";
// plane imports
import type { IWorkspaceSidebarNavigationItem } from "@plane/constants";
import {
  EUserPermissions,
  EUserPermissionsLevel,
  SUMMON_ASSISTANT_NAVIGATION_ITEM,
  SUMMON_WORKSPACE_NAVIGATION_ITEMS,
} from "@plane/constants";
import { joinUrlPath } from "@plane/utils";
// components
import { SidebarNavItem } from "@/components/sidebar/sidebar-navigation";
// store hooks
import { useAppTheme } from "@/hooks/store/use-app-theme";
import { useUser, useUserPermissions } from "@/hooks/store/user";
import { useWorkspaceNavigationPreferences } from "@/hooks/use-navigation-preferences";
import { SidebarProjectPinMenu, SidebarProjectTree, useProjectTreeMarksRoute } from "./project-tree";
import { SidebarItemBase } from "./sidebar-item";

const summonNavigationItemKeys = SUMMON_WORKSPACE_NAVIGATION_ITEMS.map(({ key }) => key);
const assistantStaticItemKeys = [...summonNavigationItemKeys, SUMMON_ASSISTANT_NAVIGATION_ITEM.key];

export const SidebarMenuItems = observer(function SidebarMenuItems() {
  const { workspaceSlug } = useParams();
  const pathname = usePathname();
  const { data: currentUser } = useUser();
  const { isWorkspaceItemPinned } = useWorkspaceNavigationPreferences();
  const { isExtendedSidebarOpened, toggleExtendedSidebar } = useAppTheme();
  const { allowPermissions } = useUserPermissions();
  const isWorkspaceAdmin = allowPermissions(
    [EUserPermissions.ADMIN],
    EUserPermissionsLevel.WORKSPACE,
    workspaceSlug?.toString()
  );

  const slug = workspaceSlug?.toString() || "";
  // The open project tree highlights the current tab itself, so Projects stands down for those routes.
  const isRouteInProjectTree = useProjectTreeMarksRoute(slug);
  const itemProps = (item: IWorkspaceSidebarNavigationItem) => {
    const href =
      item.key === "your_work" && currentUser?.id
        ? joinUrlPath(slug, item.href, currentUser.id)
        : joinUrlPath(slug, item.href);
    return { item, slug, href, isActive: item.highlight(pathname, href), isPinned: isWorkspaceItemPinned(item.key) };
  };

  return (
    <div className="flex min-h-full flex-col">
      <div className="flex flex-col gap-0.5">
        {SUMMON_WORKSPACE_NAVIGATION_ITEMS.map((item) =>
          item.key === "summon_projects" ? (
            <Fragment key={item.key}>
              <div className="group/projects relative">
                <SidebarItemBase
                  {...itemProps(item)}
                  isActive={itemProps(item).isActive && !isRouteInProjectTree}
                  additionalStaticItems={summonNavigationItemKeys}
                />
                <SidebarProjectPinMenu
                  workspaceSlug={slug}
                  className="absolute top-1/2 right-1.5 -translate-y-1/2 transition-opacity pointer-fine:opacity-0 pointer-fine:group-hover/projects:opacity-100 pointer-fine:focus-within:opacity-100 pointer-fine:has-[[aria-expanded=true]]:opacity-100"
                />
              </div>
              <SidebarProjectTree workspaceSlug={slug} />
            </Fragment>
          ) : (
            <SidebarItemBase key={item.key} {...itemProps(item)} additionalStaticItems={summonNavigationItemKeys} />
          )
        )}
        {isWorkspaceAdmin && (
          <SidebarNavItem>
            <button
              type="button"
              onClick={() => toggleExtendedSidebar()}
              className="flex flex-grow items-center gap-1.5 py-px text-13 font-medium text-tertiary"
              id="extended-sidebar-toggle"
              aria-label={`${isExtendedSidebarOpened ? "Close" : "Open"} Advanced`}
            >
              <Ellipsis className="size-4 flex-shrink-0" />
              <span>Advanced</span>
            </button>
          </SidebarNavItem>
        )}
      </div>
      <div className="mt-auto border-t border-subtle pt-2">
        <SidebarItemBase
          {...itemProps(SUMMON_ASSISTANT_NAVIGATION_ITEM)}
          additionalStaticItems={assistantStaticItemKeys}
        />
      </div>
    </div>
  );
});
