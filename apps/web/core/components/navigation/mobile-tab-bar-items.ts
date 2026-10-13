/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { IWorkspaceSidebarNavigationItem } from "@plane/constants";
import { SUMMON_ASSISTANT_NAVIGATION_ITEM, SUMMON_WORKSPACE_NAVIGATION_ITEMS } from "@plane/constants";
import { joinUrlPath } from "@plane/utils";

/** The destinations a phone keeps one tap away; everything else lives behind More. */
const TAB_KEYS = ["summon", "summon_projects", "summon_tasks", "summon_assistant"] as const;

/** More groups the remaining destinations by the job they serve. */
const MORE_GROUPS = [
  {
    key: "work",
    itemKeys: [
      "summon_opportunities",
      "summon_clients",
      "summon_meetings",
      "summon_documents",
      "summon_knowledge",
      "summon_resources",
    ],
  },
  {
    key: "operations",
    itemKeys: ["summon_reports", "summon_automation", "summon_credentials", "summon_notifications"],
  },
  { key: "workspace", itemKeys: ["summon_settings"] },
] as const;

export type TMobileNavLink = { item: IWorkspaceSidebarNavigationItem; href: string; isActive: boolean };
export type TMobileNavGroup = { key: (typeof MORE_GROUPS)[number]["key"]; links: TMobileNavLink[] };

const ALL_ITEMS = [...SUMMON_WORKSPACE_NAVIGATION_ITEMS, SUMMON_ASSISTANT_NAVIGATION_ITEM];
const itemsByKey = new Map(ALL_ITEMS.map((item) => [item.key, item]));

/**
 * The phone navigation for one workspace: the tab row and the grouped More sheet, each filtered to what the
 * viewer's role may open. More counts as the active tab whenever the open page is one of its destinations.
 */
export function getMobileNavigation(
  slug: string,
  pathname: string,
  canOpen: (item: IWorkspaceSidebarNavigationItem) => boolean
) {
  const toLink = (key: string): TMobileNavLink[] => {
    const item = itemsByKey.get(key);
    if (!item || !canOpen(item)) return [];
    const href = joinUrlPath(slug, item.href);
    return [{ item, href, isActive: item.highlight(pathname, href) }];
  };

  const tabs = TAB_KEYS.flatMap(toLink);
  const groups: TMobileNavGroup[] = MORE_GROUPS.map((group) => ({
    key: group.key,
    links: group.itemKeys.flatMap(toLink),
  })).filter((group) => group.links.length > 0);
  const isMoreActive = groups.some((group) => group.links.some((link) => link.isActive));

  return { tabs, groups, isMoreActive };
}
