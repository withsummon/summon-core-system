/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { ReactNode } from "react";
import { observer } from "mobx-react";
import Link from "next/link";
// plane imports
import type { IWorkspaceSidebarNavigationItem } from "@plane/constants";
import { EUserPermissionsLevel } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
// components
import { SidebarNavItem } from "@/components/sidebar/sidebar-navigation";
// hooks
import { useAppTheme } from "@/hooks/store/use-app-theme";
import { useUserPermissions } from "@/hooks/store/user";
// plane web imports
import { getSidebarNavigationItemIcon } from "@/components/workspace/sidebar/helper";

type Props = {
  item: IWorkspaceSidebarNavigationItem;
  slug: string;
  href: string;
  // isActive and isPinned are passed in rather than read through router hooks here, so a navigation
  // re-renders only the items whose state flips.
  isActive: boolean;
  isPinned: boolean;
  additionalRender?: (itemKey: string, workspaceSlug: string) => ReactNode;
  additionalStaticItems?: string[];
};

export const SidebarItemBase = observer(function SidebarItemBase({
  item,
  slug,
  href,
  isActive,
  isPinned,
  additionalRender,
  additionalStaticItems,
}: Props) {
  const { t } = useTranslation();
  const { allowPermissions } = useUserPermissions();

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
  if (!allowPermissions(item.access, EUserPermissionsLevel.WORKSPACE, slug)) return null;

  if (!isPinned && !staticItems.includes(item.key)) return null;

  const icon = getSidebarNavigationItemIcon(item.key);

  return (
    <Link href={href} onClick={handleLinkClick}>
      <SidebarNavItem isActive={isActive}>
        <div className="flex items-center gap-1.5 py-[1px]">
          {icon}
          <p className="text-13 leading-5">{t(item.labelTranslationKey)}</p>
        </div>
        {additionalRender?.(item.key, slug)}
      </SidebarNavItem>
    </Link>
  );
});
