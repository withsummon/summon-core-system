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

      // ====================================================================
      // SETTINGS SECTION
      // ====================================================================
      layout("./(all)/[workspaceSlug]/(settings)/layout.tsx", [
        // --------------------------------------------------------------------
        // WORKSPACE SETTINGS
        // --------------------------------------------------------------------

        layout("./(all)/[workspaceSlug]/(settings)/settings/(workspace)/layout.tsx", [
          route(
            ":workspaceSlug/settings/billing",
            "./(all)/[workspaceSlug]/(settings)/settings/(workspace)/billing/page.tsx"
          ),
          route(
            ":workspaceSlug/settings/exports",
            "./(all)/[workspaceSlug]/(settings)/settings/(workspace)/exports/page.tsx"
          ),
          route(
            ":workspaceSlug/settings/webhooks",
            "./(all)/[workspaceSlug]/(settings)/settings/(workspace)/webhooks/page.tsx"
          ),
          route(
            ":workspaceSlug/settings/webhooks/:webhookId",
            "./(all)/[workspaceSlug]/(settings)/settings/(workspace)/webhooks/[webhookId]/page.tsx"
          ),
        ]),

        // --------------------------------------------------------------------
        // PROJECT SETTINGS
        // --------------------------------------------------------------------

        layout("./(all)/[workspaceSlug]/(settings)/settings/projects/layout.tsx", [
          // No Projects available page
          route(":workspaceSlug/settings/projects", "./(all)/[workspaceSlug]/(settings)/settings/projects/page.tsx"),
          layout("./(all)/[workspaceSlug]/(settings)/settings/projects/[projectId]/layout.tsx", [
            // Project States
            route(
              ":workspaceSlug/settings/projects/:projectId/states",
              "./(all)/[workspaceSlug]/(settings)/settings/projects/[projectId]/states/page.tsx"
            ),
            // Project Labels
            route(
              ":workspaceSlug/settings/projects/:projectId/labels",
              "./(all)/[workspaceSlug]/(settings)/settings/projects/[projectId]/labels/page.tsx"
            ),
            // Project Automations
            layout("./(all)/[workspaceSlug]/(settings)/settings/projects/[projectId]/automations/layout.tsx", [
              route(
                ":workspaceSlug/settings/projects/:projectId/automations",
                "./(all)/[workspaceSlug]/(settings)/settings/projects/[projectId]/automations/page.tsx"
              ),
            ]),
          ]),
        ]),
      ]),
    ]),
    // ======================================================================
    // STANDALONE ROUTES (outside workspace context)
    // ======================================================================
  ]),

  // ========================================================================
  // REDIRECT ROUTES
  // ========================================================================
  // Legacy URL redirects for backward compatibility

  // --------------------------------------------------------------------
  // REDIRECT ROUTES
  // --------------------------------------------------------------------

  // Project settings redirect: /:workspaceSlug/projects/:projectId/settings/:path*
  // → /:workspaceSlug/settings/projects/:projectId/:path*
  route(":workspaceSlug/projects/:projectId/settings/*", "routes/redirects/core/project-settings.tsx"),

  // Analytics redirect: /:workspaceSlug/analytics → /:workspaceSlug/analytics/overview
  route(":workspaceSlug/analytics", "routes/redirects/core/analytics.tsx"),

  // API tokens redirect: /:workspaceSlug/settings/api-tokens
  // → /settings/profile/api-tokens
  route(":workspaceSlug/settings/api-tokens", "routes/redirects/core/api-tokens.tsx"),

  // Inbox redirect: /:workspaceSlug/projects/:projectId/inbox
  // → /:workspaceSlug/projects/:projectId/intake
  route(":workspaceSlug/projects/:projectId/inbox", "routes/redirects/core/inbox.tsx"),

  // Sign-up redirects
  route("accounts/sign-up", "routes/redirects/core/accounts-signup.tsx"),

  // Sign-in redirects (all redirect to home page)
  route("sign-in", "routes/redirects/core/sign-in.tsx"),
  route("signin", "routes/redirects/core/signin.tsx"),
  route("login", "routes/redirects/core/login.tsx"),

  // Register redirect
  route("register", "routes/redirects/core/register.tsx"),

  // Profile settings redirects
  route("profile/*", "routes/redirects/core/profile-settings.tsx"),

  // Account settings redirects
  route(":workspaceSlug/settings/account/*", "routes/redirects/core/workspace-account-settings.tsx"),
] satisfies RouteConfig;
