/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { IWorkspaceSidebarNavigationItem } from "./workspace";
import { EUserWorkspaceRoles } from "@plane/types";

export const SUMMON_MODULES = [
  { key: "summon", label: "Home", path: "" },
  { key: "summon_projects", label: "Projects", path: "projects" },
  { key: "summon_opportunities", label: "Opportunities", path: "opportunities" },
  { key: "summon_clients", label: "Clients", path: "clients" },
  { key: "summon_tasks", label: "Tasks", path: "tasks" },
  { key: "summon_documents", label: "Documents", path: "documents" },
  { key: "summon_knowledge", label: "Knowledge", path: "knowledge" },
  { key: "summon_resources", label: "Resources", path: "resources" },
  { key: "summon_automation", label: "Automation Studio", path: "automation" },
  { key: "summon_credentials", label: "Credentials", path: "credentials" },
  { key: "summon_reports", label: "Reports", path: "reports" },
  { key: "summon_notifications", label: "Notifications", path: "notifications" },
  { key: "summon_settings", label: "Settings", path: "settings" },
] as const;

export const SUMMON_ASSISTANT_NAVIGATION_ITEM: IWorkspaceSidebarNavigationItem = {
  key: "summon_assistant",
  labelTranslationKey: "summon.assistant",
  href: "/summon/assistant",
  access: [EUserWorkspaceRoles.ADMIN, EUserWorkspaceRoles.MEMBER, EUserWorkspaceRoles.GUEST],
  highlight: (pathname, url) => pathname === url || pathname.startsWith(`${url}/`),
};

const allWorkspaceRoles = [EUserWorkspaceRoles.ADMIN, EUserWorkspaceRoles.MEMBER, EUserWorkspaceRoles.GUEST];
const memberWorkspaceRoles = [EUserWorkspaceRoles.ADMIN, EUserWorkspaceRoles.MEMBER];
const adminWorkspaceRoles = [EUserWorkspaceRoles.ADMIN];

export const SUMMON_WORKSPACE_NAVIGATION_ITEMS: IWorkspaceSidebarNavigationItem[] = SUMMON_MODULES.map((module) => ({
  key: module.key,
  labelTranslationKey: `summon.${module.path || "overview"}`,
  href: `/summon${module.path ? `/${module.path}` : ""}`,
  access:
    module.key === "summon_settings"
      ? adminWorkspaceRoles
      : module.key === "summon_credentials"
        ? memberWorkspaceRoles
        : allWorkspaceRoles,
  highlight: (pathname, url) =>
    module.path ? pathname === url || pathname.startsWith(`${url}/`) : pathname === url || pathname === `${url}/`,
}));
