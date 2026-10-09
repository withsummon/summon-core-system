/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { ReactNode } from "react";
import { observer } from "mobx-react";
import { WorkspaceSidebarLink } from "./sidebar-link";
import { useParams, usePathname } from "next/navigation";
// plane imports
import type { IWorkspaceSidebarNavigationItem } from "@plane/constants";
import { EUserPermissionsLevel } from "@plane/constants";
import { joinUrlPath } from "@plane/utils";
// components
// hooks
import { useAppTheme } from "@/hooks/store/use-app-theme";
import { useUser, useUserPermissions } from "@/hooks/store/user";
import { useWorkspaceNavigationPreferences } from "@/hooks/use-navigation-preferences";
// plane web imports

type Props = {
  item: IWorkspaceSidebarNavigationItem;
  additionalRender?: (itemKey: string, workspaceSlug: string) => ReactNode;
  additionalStaticItems?: string[];
};

export const SidebarItemBase = observer(function SidebarItemBase({
  item,
  additionalRender,
  additionalStaticItems,
}: Props) {
  const pathname = usePathname();
  const { workspaceSlug } = useParams();
  const { allowPermissions } = useUserPermissions();
  const { isWorkspaceItemPinned } = useWorkspaceNavigationPreferences();
  const { data } = useUser();

  const { toggleSidebar, isExtendedSidebarOpened, toggleExtendedSidebar } = useAppTheme();

  const handleLinkClick = () => {
    if (window.innerWidth < 768) toggleSidebar();
    if (isExtendedSidebarOpened) toggleExtendedSidebar(false);
  };

  const staticItems = [
    "home",
    "pi_chat",
    "projects",
    "your_work",
    "stickies",
    "drafts",
    ...(additionalStaticItems || []),
  ];
  const slug = workspaceSlug?.toString() || "";

  if (!allowPermissions(item.access, EUserPermissionsLevel.WORKSPACE, slug)) return null;

  const isPinned = isWorkspaceItemPinned(item.key);
  if (!isPinned && !staticItems.includes(item.key)) return null;

  const itemHref =
    item.key === "your_work" && data?.id ? joinUrlPath(slug, item.href, data?.id) : joinUrlPath(slug, item.href);

  return (
    <WorkspaceSidebarLink
      item={item}
      href={itemHref}
      pathname={pathname}
      onClick={handleLinkClick}
      prefetch={additionalStaticItems?.includes(item.key) ? "render" : undefined}
    >
      {additionalRender?.(item.key, slug)}
    </WorkspaceSidebarLink>
  );
});
