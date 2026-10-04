/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { nativeStickiesRoute } from "./ownership";
import { layout, route } from "@react-router/dev/routes";
import type { RouteConfig, RouteConfigEntry } from "@react-router/dev/routes";

export const coreRoutes: RouteConfigEntry[] = [
  // ========================================================================
  // ALL APP ROUTES
  // ========================================================================
  layout("./(all)/layout.tsx", [
    // ======================================================================
    // WORKSPACE-SCOPED ROUTES
    // ======================================================================
    layout("./(all)/[workspaceSlug]/layout.tsx", [
      // ====================================================================
      // PROJECTS APP SECTION - WORKSPACE LEVEL ROUTES
      // ====================================================================
      layout("./(all)/[workspaceSlug]/(projects)/layout.tsx", [
        // --------------------------------------------------------------------
        // WORKSPACE LEVEL ROUTES
        // --------------------------------------------------------------------

        // Workspace Home
        route(":workspaceSlug", "./(all)/[workspaceSlug]/(projects)/page.tsx"),

        // Active Cycles
        layout("./(all)/[workspaceSlug]/(projects)/active-cycles/layout.tsx", [
          route(":workspaceSlug/active-cycles", "./(all)/[workspaceSlug]/(projects)/active-cycles/page.tsx"),
        ]),

        // Analytics
        layout("./(all)/[workspaceSlug]/(projects)/analytics/[tabId]/layout.tsx", [
          route(":workspaceSlug/analytics/:tabId", "./(all)/[workspaceSlug]/(projects)/analytics/[tabId]/page.tsx"),
        ]),

        // Stickies
        ...(nativeStickiesRoute
          ? []
          : [
              layout("./(all)/[workspaceSlug]/(projects)/stickies/layout.tsx", [
                route(":workspaceSlug/stickies", "./(all)/[workspaceSlug]/(projects)/stickies/page.tsx"),
              ]),
            ]),

        // --------------------------------------------------------------------
        // PROJECT LEVEL ROUTES
        // --------------------------------------------------------------------

        // Project Detail
        layout("./(all)/[workspaceSlug]/(projects)/projects/(detail)/[projectId]/layout.tsx", [
          // View Detail
          layout("./(all)/[workspaceSlug]/(projects)/projects/(detail)/[projectId]/views/(detail)/layout.tsx", [
            route(
              ":workspaceSlug/projects/:projectId/views/:viewId",
              "./(all)/[workspaceSlug]/(projects)/projects/(detail)/[projectId]/views/(detail)/[viewId]/page.tsx"
            ),
          ]),

          // Views List
          layout("./(all)/[workspaceSlug]/(projects)/projects/(detail)/[projectId]/views/(list)/layout.tsx", [
            route(
              ":workspaceSlug/projects/:projectId/views",
              "./(all)/[workspaceSlug]/(projects)/projects/(detail)/[projectId]/views/(list)/page.tsx"
            ),
          ]),

          // Automation
          layout("./(all)/[workspaceSlug]/(projects)/projects/(detail)/[projectId]/automation/layout.tsx", [
            route(
              ":workspaceSlug/projects/:projectId/automation",
              "./(all)/[workspaceSlug]/(projects)/projects/(detail)/[projectId]/automation/page.tsx"
            ),
          ]),
        ]),

        // Project Archives - Issues, Cycles, Modules
        // Project Archives - Issues - List
        layout("./(all)/[workspaceSlug]/(projects)/projects/(detail)/[projectId]/archives/issues/(list)/layout.tsx", [
          route(
            ":workspaceSlug/projects/:projectId/archives/issues",
            "./(all)/[workspaceSlug]/(projects)/projects/(detail)/[projectId]/archives/issues/(list)/page.tsx"
          ),
        ]),

        // Project Archives - Issues - Detail
        layout("./(all)/[workspaceSlug]/(projects)/projects/(detail)/[projectId]/archives/issues/(detail)/layout.tsx", [
          route(
            ":workspaceSlug/projects/:projectId/archives/issues/:archivedIssueId",
            "./(all)/[workspaceSlug]/(projects)/projects/(detail)/[projectId]/archives/issues/(detail)/[archivedIssueId]/page.tsx"
          ),
        ]),
      ]),
    ]),
  ]),

  // Analytics remains owned by its legacy destination.
  route(":workspaceSlug/analytics", "routes/redirects/core/analytics.tsx"),
] satisfies RouteConfig;
