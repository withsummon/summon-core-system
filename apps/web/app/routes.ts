/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { index, layout, route } from "@react-router/dev/routes";
import type { RouteConfigEntry } from "@react-router/dev/routes";
import { nativeStickiesRoute } from "./routes/ownership";
import { coreRoutes } from "./routes/core";
import { extendedRoutes } from "./routes/extended";
import { mergeRoutes } from "./routes/helper";

/**
 * Main Routes Configuration
 * This file serves as the entry point for the route configuration.
 */
const mergedRoutes: RouteConfigEntry[] = mergeRoutes(coreRoutes, extendedRoutes);

// Add catch-all route at the end (404 handler)
const routes: RouteConfigEntry[] = [
  layout("./native-layout.tsx", [
    // Home - Sign In
    layout("./(home)/layout.tsx", [index("./(home)/page.tsx")]),

    // Sign Up
    layout("./(all)/sign-up/layout.tsx", [route("sign-up", "./(all)/sign-up/page.tsx")]),

    // Account Routes - Password Management
    layout("./(all)/accounts/forgot-password/layout.tsx", [
      route("accounts/forgot-password", "./(all)/accounts/forgot-password/page.tsx"),
    ]),
    layout("./(all)/accounts/reset-password/layout.tsx", [
      route("accounts/reset-password", "./(all)/accounts/reset-password/page.tsx"),
    ]),
    layout("./(all)/accounts/set-password/layout.tsx", [
      route("accounts/set-password", "./(all)/accounts/set-password/page.tsx"),
    ]),

    // Account and workspace entry share the native session.
    layout("./(all)/onboarding/layout.tsx", [route("onboarding", "./(all)/onboarding/page.tsx")]),
    layout("./(all)/create-workspace/layout.tsx", [route("create-workspace", "./(all)/create-workspace/page.tsx")]),
    layout("./(all)/invitations/layout.tsx", [route("invitations", "./(all)/invitations/page.tsx")]),
    layout("./(all)/workspace-invitations/layout.tsx", [
      route("workspace-invitations", "./(all)/workspace-invitations/page.tsx"),
    ]),

    route("core", "./core.tsx"),
    layout("./native-workspace.tsx", [
      ...(nativeStickiesRoute ? [route(":workspaceSlug/stickies", "./native-stickies.tsx")] : []),
      route(":workspaceSlug/workspace-views/all-issues", "./native-workspace-views.tsx"),
      // Active and archived Projects share one directory/dialog owner.
      layout("./(all)/[workspaceSlug]/(projects)/projects/(list)/layout.tsx", [
        route(":workspaceSlug/projects", "./(all)/[workspaceSlug]/(projects)/projects/(list)/page.tsx"),
        route(
          ":workspaceSlug/projects/archives",
          "./(all)/[workspaceSlug]/(projects)/projects/(detail)/archives/page.tsx"
        ),
      ]),
      layout("./(all)/[workspaceSlug]/(projects)/browse/[workItem]/layout.tsx", [
        route(":workspaceSlug/browse/:workItem", "./(all)/[workspaceSlug]/(projects)/browse/[workItem]/page.tsx"),
      ]),
      route(
        ":workspaceSlug/projects/:projectId/intake",
        "./(all)/[workspaceSlug]/(projects)/projects/(detail)/[projectId]/intake/page.tsx"
      ),
      layout("./(all)/[workspaceSlug]/(projects)/projects/(detail)/[projectId]/issues/(list)/layout.tsx", [
        route(
          ":workspaceSlug/projects/:projectId/issues",
          "./(all)/[workspaceSlug]/(projects)/projects/(detail)/[projectId]/issues/(list)/page.tsx"
        ),
      ]),
      route(
        ":workspaceSlug/projects/:projectId/issues/:issueId",
        "./(all)/[workspaceSlug]/(projects)/projects/(detail)/[projectId]/issues/(detail)/[issueId]/page.tsx"
      ),
      // Cycle Detail
      layout("./(all)/[workspaceSlug]/(projects)/projects/(detail)/[projectId]/cycles/(detail)/layout.tsx", [
        route(
          ":workspaceSlug/projects/:projectId/cycles/:cycleId",
          "./(all)/[workspaceSlug]/(projects)/projects/(detail)/[projectId]/cycles/(detail)/[cycleId]/page.tsx"
        ),
      ]),
      // Cycles List
      layout("./(all)/[workspaceSlug]/(projects)/projects/(detail)/[projectId]/cycles/(list)/layout.tsx", [
        route(
          ":workspaceSlug/projects/:projectId/cycles",
          "./(all)/[workspaceSlug]/(projects)/projects/(detail)/[projectId]/cycles/(list)/page.tsx"
        ),
      ]),
      // Module Detail
      layout("./(all)/[workspaceSlug]/(projects)/projects/(detail)/[projectId]/modules/(detail)/layout.tsx", [
        route(
          ":workspaceSlug/projects/:projectId/modules/:moduleId",
          "./(all)/[workspaceSlug]/(projects)/projects/(detail)/[projectId]/modules/(detail)/[moduleId]/page.tsx"
        ),
      ]),
      // Modules List
      layout("./(all)/[workspaceSlug]/(projects)/projects/(detail)/[projectId]/modules/(list)/layout.tsx", [
        route(
          ":workspaceSlug/projects/:projectId/modules",
          "./(all)/[workspaceSlug]/(projects)/projects/(detail)/[projectId]/modules/(list)/page.tsx"
        ),
      ]),
      // Project Archives - Cycles
      layout("./(all)/[workspaceSlug]/(projects)/projects/(detail)/[projectId]/archives/cycles/layout.tsx", [
        route(
          ":workspaceSlug/projects/:projectId/archives/cycles",
          "./(all)/[workspaceSlug]/(projects)/projects/(detail)/[projectId]/archives/cycles/page.tsx"
        ),
      ]),
      // Project Archives - Modules
      layout("./(all)/[workspaceSlug]/(projects)/projects/(detail)/[projectId]/archives/modules/layout.tsx", [
        route(
          ":workspaceSlug/projects/:projectId/archives/modules",
          "./(all)/[workspaceSlug]/(projects)/projects/(detail)/[projectId]/archives/modules/page.tsx"
        ),
      ]),
      layout("./(all)/[workspaceSlug]/(projects)/projects/(detail)/[projectId]/pages/(list)/layout.tsx", [
        route(
          ":workspaceSlug/projects/:projectId/pages",
          "./(all)/[workspaceSlug]/(projects)/projects/(detail)/[projectId]/pages/(list)/page.tsx"
        ),
        route(
          ":workspaceSlug/projects/:projectId/pages/:pageId",
          "./(all)/[workspaceSlug]/(projects)/projects/(detail)/[projectId]/pages/(detail)/[pageId]/page.tsx"
        ),
      ]),
      // Project Features
      route(
        ":workspaceSlug/settings/projects/:projectId/features/cycles",
        "./(all)/[workspaceSlug]/(settings)/settings/projects/[projectId]/features/cycles/page.tsx"
      ),
      route(
        ":workspaceSlug/settings/projects/:projectId/features/modules",
        "./(all)/[workspaceSlug]/(settings)/settings/projects/[projectId]/features/modules/page.tsx"
      ),
      route(
        ":workspaceSlug/settings/projects/:projectId/features/views",
        "./(all)/[workspaceSlug]/(settings)/settings/projects/[projectId]/features/views/page.tsx"
      ),
      route(
        ":workspaceSlug/settings/projects/:projectId/features/pages",
        "./(all)/[workspaceSlug]/(settings)/settings/projects/[projectId]/features/pages/page.tsx"
      ),
      route(
        ":workspaceSlug/settings/projects/:projectId/features/intake",
        "./(all)/[workspaceSlug]/(settings)/settings/projects/[projectId]/features/intake/page.tsx"
      ),
      route(":workspaceSlug/settings", "./(all)/[workspaceSlug]/(settings)/settings/(workspace)/page.tsx"),
      route(
        ":workspaceSlug/settings/members",
        "./(all)/[workspaceSlug]/(settings)/settings/(workspace)/members/page.tsx"
      ),
    ]),
    layout("./(all)/settings/profile/layout.tsx", [
      route("settings/profile/:profileTabId", "./(all)/settings/profile/[profileTabId]/page.tsx"),
    ]),
  ]),
  layout("./legacy-layout.tsx", [...mergedRoutes, route("*", "./not-found.tsx")]),
];

export default routes;
