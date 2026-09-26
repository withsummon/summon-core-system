/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import React from "react";
import { observer } from "mobx-react";
import { useParams } from "next/navigation";
import { CollapsiblePrimitive } from "@plane/propel/collapsible";
// plane imports
import { AnalyticsIcon, CycleIcon, ProjectIcon, ViewsIcon } from "@plane/propel/icons";
import { EUserWorkspaceRoles } from "@plane/types";
// hooks
import useLocalStorage from "@/hooks/use-local-storage";
// local imports
import { SidebarWorkspaceMenuHeader } from "./workspace-menu-header";
import { SidebarWorkspaceMenuItem } from "./workspace-menu-item";

export const SidebarWorkspaceMenu = observer(function SidebarWorkspaceMenu() {
  // router params
  const { workspaceSlug } = useParams();
  // local storage
  const { setValue: toggleWorkspaceMenu, storedValue } = useLocalStorage<boolean>("is_workspace_menu_open", true);
  // derived values
  const isWorkspaceMenuOpen = !!storedValue;

  const SIDEBAR_WORKSPACE_MENU_ITEMS = [
    {
      key: "projects",
      labelTranslationKey: "sidebar.projects",
      href: `/${workspaceSlug}/projects/`,
      access: [EUserWorkspaceRoles.ADMIN, EUserWorkspaceRoles.MEMBER, EUserWorkspaceRoles.GUEST],
      Icon: ProjectIcon,
    },
    {
      key: "views",
      labelTranslationKey: "sidebar.views",
      href: `/${workspaceSlug}/workspace-views/all-issues/`,
      access: [EUserWorkspaceRoles.ADMIN, EUserWorkspaceRoles.MEMBER, EUserWorkspaceRoles.GUEST],
      Icon: ViewsIcon,
    },
    {
      key: "active-cycles",
      labelTranslationKey: "sidebar.cycles",
      href: `/${workspaceSlug}/active-cycles/`,
      access: [EUserWorkspaceRoles.ADMIN, EUserWorkspaceRoles.MEMBER],
      Icon: CycleIcon,
    },
    {
      key: "analytics",
      labelTranslationKey: "sidebar.analytics",
      href: `/${workspaceSlug}/analytics/`,
      access: [EUserWorkspaceRoles.ADMIN, EUserWorkspaceRoles.MEMBER],
      Icon: AnalyticsIcon,
    },
  ];

  return (
    <CollapsiblePrimitive.Root open={isWorkspaceMenuOpen} onOpenChange={toggleWorkspaceMenu}>
      <SidebarWorkspaceMenuHeader isWorkspaceMenuOpen={isWorkspaceMenuOpen} />
      <CollapsiblePrimitive.Panel className="mt-0.5 flex flex-col gap-0.5">
        {SIDEBAR_WORKSPACE_MENU_ITEMS.map((item) => (
          <SidebarWorkspaceMenuItem key={item.key} item={item} />
        ))}
      </CollapsiblePrimitive.Panel>
    </CollapsiblePrimitive.Root>
  );
});
