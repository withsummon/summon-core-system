/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { IWorkspaceSidebarNavigationItem } from "./workspace";
import { EUserWorkspaceRoles } from "@plane/types";

export const SUMMON_MODULES = [
  { key: "summon", label: "Overview", path: "" },
  { key: "summon_clients", label: "Clients", path: "clients" },
  { key: "summon_opportunities", label: "Opportunities", path: "opportunities" },
  { key: "summon_reports", label: "Reports", path: "reports" },
  { key: "summon_resources", label: "Resources", path: "resources" },
  { key: "summon_meetings", label: "Meetings", path: "meetings" },
  { key: "summon_automation", label: "Automation", path: "automation" },
  { key: "summon_assistant", label: "Assistant", path: "assistant" },
  { key: "summon_credentials", label: "Credentials", path: "credentials" },
  { key: "summon_settings", label: "Settings", path: "settings" },
] as const;

const allWorkspaceRoles = [EUserWorkspaceRoles.ADMIN, EUserWorkspaceRoles.MEMBER, EUserWorkspaceRoles.GUEST];
const memberWorkspaceRoles = [EUserWorkspaceRoles.ADMIN, EUserWorkspaceRoles.MEMBER];

export const SUMMON_WORKSPACE_NAVIGATION_ITEMS: IWorkspaceSidebarNavigationItem[] = SUMMON_MODULES.filter(
  (module) => module.key !== "summon_settings"
).map((module) => ({
  key: module.key,
  labelTranslationKey: `summon.${module.path || "overview"}`,
  href: `/summon${module.path ? `/${module.path}` : ""}`,
  access: module.key === "summon_credentials" ? memberWorkspaceRoles : allWorkspaceRoles,
  highlight: (pathname, url) => pathname.includes(url),
}));
