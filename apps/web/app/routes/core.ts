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
          // Automation
          layout("./(all)/[workspaceSlug]/(projects)/projects/(detail)/[projectId]/automation/layout.tsx", [
            route(
              ":workspaceSlug/projects/:projectId/automation",
              "./(all)/[workspaceSlug]/(projects)/projects/(detail)/[projectId]/automation/page.tsx"
            ),
          ]),
        ]),
      ]),
    ]),
  ]),

  // Analytics remains owned by its legacy destination.
  route(":workspaceSlug/analytics", "routes/redirects/core/analytics.tsx"),
] satisfies RouteConfig;
