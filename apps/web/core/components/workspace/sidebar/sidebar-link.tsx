/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { ReactNode } from "react";
import Link from "next/link";
import type { IWorkspaceSidebarNavigationItem } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
import { SidebarNavItem } from "@/components/sidebar/sidebar-navigation";
import { getSidebarNavigationItemIcon } from "./helper";
export function WorkspaceSidebarLink({
  item,
  href,
  pathname,
  onClick,
  prefetch,
  children,
}: {
  item: IWorkspaceSidebarNavigationItem;
  href: string;
  pathname: string;
  onClick: () => void;
  prefetch?: "render";
  children?: ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <Link href={href} onClick={onClick} prefetch={prefetch}>
      <SidebarNavItem isActive={item.highlight(pathname, href)}>
        <div className="flex items-center gap-1.5 py-[1px]">
          {getSidebarNavigationItemIcon(item.key)}
          <p className="text-13 leading-5 font-medium">{t(item.labelTranslationKey)}</p>
        </div>
        {children}
      </SidebarNavItem>
    </Link>
  );
}
