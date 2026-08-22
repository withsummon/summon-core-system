/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { layout, route } from "@react-router/dev/routes";
import type { RouteConfigEntry } from "@react-router/dev/routes";

const summonRoot = "./(all)/[workspaceSlug]/(projects)/summon";

export const extendedRoutes: RouteConfigEntry[] = [
  layout("./(all)/layout.tsx", [
    layout("./(all)/[workspaceSlug]/layout.tsx", [
      layout("./(all)/[workspaceSlug]/(projects)/layout.tsx", [
        layout(`${summonRoot}/layout.tsx`, [
          route(":workspaceSlug/summon", `${summonRoot}/page.tsx`),
          route(":workspaceSlug/summon/projects", `${summonRoot}/projects/page.tsx`),
          route(":workspaceSlug/summon/projects/:projectId", `${summonRoot}/projects/[projectId]/page.tsx`),
          route(":workspaceSlug/summon/tasks", `${summonRoot}/tasks/page.tsx`),
          route(":workspaceSlug/summon/documents", `${summonRoot}/documents/page.tsx`),
          route(":workspaceSlug/summon/knowledge", `${summonRoot}/knowledge/page.tsx`),
          route(":workspaceSlug/summon/clients", `${summonRoot}/clients/page.tsx`),
          route(":workspaceSlug/summon/clients/:clientId", `${summonRoot}/clients/[clientId]/page.tsx`),
          route(":workspaceSlug/summon/opportunities", `${summonRoot}/opportunities/page.tsx`),
          route(
            ":workspaceSlug/summon/opportunities/:opportunityId",
            `${summonRoot}/opportunities/[opportunityId]/page.tsx`
          ),
          route(":workspaceSlug/summon/reports", `${summonRoot}/reports/page.tsx`),
          route(":workspaceSlug/summon/resources", `${summonRoot}/resources/page.tsx`),
          route(":workspaceSlug/summon/notifications", `${summonRoot}/notifications/page.tsx`),
          route(":workspaceSlug/summon/meetings", `${summonRoot}/meetings/page.tsx`),
          route(":workspaceSlug/summon/meetings/:meetingId", `${summonRoot}/meetings/[meetingId]/page.tsx`),
          route(":workspaceSlug/summon/automation", `${summonRoot}/automation/page.tsx`),
          route(":workspaceSlug/summon/assistant", `${summonRoot}/assistant/page.tsx`),
          route(":workspaceSlug/summon/credentials", `${summonRoot}/credentials/page.tsx`),
          route(":workspaceSlug/summon/settings", `${summonRoot}/settings/page.tsx`),
        ]),
      ]),
    ]),
  ]),
];
