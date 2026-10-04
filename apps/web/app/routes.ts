/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { index, layout, route } from "@react-router/dev/routes";
import type { RouteConfigEntry } from "@react-router/dev/routes";
import { nativeStickiesRoute } from "./routes/ownership";
import { coreRoutes } from "./routes/core";

/**
 * Main Routes Configuration
 * This file serves as the entry point for the route configuration.
 */
// Add catch-all route at the end (404 handler)
const routes: RouteConfigEntry[] = [
  layout("./native-layout.tsx", [
    // Existing URL aliases share the native session with their destinations.
    route(":workspaceSlug/projects/:projectId/settings/*", "routes/redirects/core/project-settings.tsx"),
    route(":workspaceSlug/settings/api-tokens", "routes/redirects/core/api-tokens.tsx"),
    route(":workspaceSlug/projects/:projectId/inbox", "routes/redirects/core/inbox.tsx"),
    route("accounts/sign-up", "routes/redirects/core/accounts-signup.tsx"),
    route("sign-in", "routes/redirects/core/sign-in.tsx"),
    route("signin", "routes/redirects/core/signin.tsx"),
    route("login", "routes/redirects/core/login.tsx"),
    route("register", "routes/redirects/core/register.tsx"),
    route("profile/*", "routes/redirects/core/profile-settings.tsx"),
    route(":workspaceSlug/settings/account/*", "routes/redirects/core/workspace-account-settings.tsx"),

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
      route(":workspaceSlug/summon", `./(all)/[workspaceSlug]/(projects)/summon/page.tsx`),
      route(":workspaceSlug/summon/projects", `./(all)/[workspaceSlug]/(projects)/summon/projects/page.tsx`),
      route(
        ":workspaceSlug/summon/projects/:projectId",
        `./(all)/[workspaceSlug]/(projects)/summon/projects/[projectId]/page.tsx`
      ),
      route(":workspaceSlug/summon/documents", `./(all)/[workspaceSlug]/(projects)/summon/documents/page.tsx`),
      route(":workspaceSlug/summon/knowledge", `./(all)/[workspaceSlug]/(projects)/summon/knowledge/page.tsx`),
      route(":workspaceSlug/summon/reports", `./(all)/[workspaceSlug]/(projects)/summon/reports/page.tsx`),
      route(":workspaceSlug/summon/resources", `./(all)/[workspaceSlug]/(projects)/summon/resources/page.tsx`),
      route(":workspaceSlug/summon/notifications", `./(all)/[workspaceSlug]/(projects)/summon/notifications/page.tsx`),
      route(":workspaceSlug/summon/automation", `./(all)/[workspaceSlug]/(projects)/summon/automation/page.tsx`),
      route(
        ":workspaceSlug/summon/automation/:jobId",
        `./(all)/[workspaceSlug]/(projects)/summon/automation/[jobId]/page.tsx`
      ),
      route(":workspaceSlug/summon/assistant", `./(all)/[workspaceSlug]/(projects)/summon/assistant/page.tsx`),
      route(":workspaceSlug/summon/credentials", `./(all)/[workspaceSlug]/(projects)/summon/credentials/page.tsx`),
      route(":workspaceSlug/summon/settings", `./(all)/[workspaceSlug]/(projects)/summon/settings/page.tsx`),
      route(":workspaceSlug/summon/tasks", "./(all)/[workspaceSlug]/(projects)/summon/tasks/page.tsx"),
      layout("./(all)/[workspaceSlug]/(projects)/drafts/layout.tsx", [
        route(":workspaceSlug/drafts", "./(all)/[workspaceSlug]/(projects)/drafts/page.tsx"),
      ]),
      route(":workspaceSlug/summon/meetings", "./(all)/[workspaceSlug]/(projects)/summon/meetings/page.tsx"),
      route(
        ":workspaceSlug/summon/meetings/:meetingId",
        "./(all)/[workspaceSlug]/(projects)/summon/meetings/[meetingId]/page.tsx"
      ),
      route(":workspaceSlug/notifications", "./(all)/[workspaceSlug]/(projects)/notifications/page.tsx"),
      layout("./(all)/[workspaceSlug]/(projects)/profile/[userId]/layout.tsx", [
        route(":workspaceSlug/profile/:userId", "./(all)/[workspaceSlug]/(projects)/profile/[userId]/page.tsx"),
        route(
          ":workspaceSlug/profile/:userId/:profileViewId",
          "./(all)/[workspaceSlug]/(projects)/profile/[userId]/[profileViewId]/page.tsx"
        ),
        route(
          ":workspaceSlug/profile/:userId/activity",
          "./(all)/[workspaceSlug]/(projects)/profile/[userId]/activity/page.tsx"
        ),
      ]),
      ...(nativeStickiesRoute ? [route(":workspaceSlug/stickies", "./native-stickies.tsx")] : []),
      route(":workspaceSlug/workspace-views", "./(all)/[workspaceSlug]/(projects)/workspace-views/page.tsx"),
      layout("./(all)/[workspaceSlug]/(projects)/projects/(detail)/[projectId]/views/(list)/layout.tsx", [
        route(
          ":workspaceSlug/projects/:projectId/views",
          "./(all)/[workspaceSlug]/(projects)/projects/(detail)/[projectId]/views/(list)/page.tsx"
        ),
      ]),
      route(":workspaceSlug/workspace-views/all-issues", "./native-workspace-views.tsx", {
        id: "native-workspace-views-all-issues",
      }),
      route(":workspaceSlug/workspace-views/assigned", "./native-workspace-views.tsx", {
        id: "native-workspace-views-assigned",
      }),
      route(":workspaceSlug/workspace-views/created", "./native-workspace-views.tsx", {
        id: "native-workspace-views-created",
      }),
      route(":workspaceSlug/workspace-views/subscribed", "./native-workspace-views.tsx", {
        id: "native-workspace-views-subscribed",
      }),
      route(":workspaceSlug/workspace-views/:globalViewId", "./native-workspace-view-detail.tsx"),
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
      layout("./(all)/[workspaceSlug]/(projects)/summon/layout.tsx", [
        route(":workspaceSlug/summon/clients", "./(all)/[workspaceSlug]/(projects)/summon/clients/page.tsx"),
        route(
          ":workspaceSlug/summon/clients/:clientId",
          "./(all)/[workspaceSlug]/(projects)/summon/clients/[clientId]/page.tsx"
        ),
        route(
          ":workspaceSlug/summon/opportunities",
          "./(all)/[workspaceSlug]/(projects)/summon/opportunities/page.tsx"
        ),
        route(
          ":workspaceSlug/summon/opportunities/:opportunityId",
          "./(all)/[workspaceSlug]/(projects)/summon/opportunities/[opportunityId]/page.tsx"
        ),
      ]),
      route(
        ":workspaceSlug/settings/projects/:projectId",
        "./(all)/[workspaceSlug]/(settings)/settings/projects/[projectId]/page.tsx"
      ),
      route(
        ":workspaceSlug/settings/projects/:projectId/members",
        "./(all)/[workspaceSlug]/(settings)/settings/projects/[projectId]/members/page.tsx"
      ),
      route(
        ":workspaceSlug/settings/projects/:projectId/states",
        "./(all)/[workspaceSlug]/(settings)/settings/projects/[projectId]/states/page.tsx"
      ),
      route(
        ":workspaceSlug/settings/projects/:projectId/labels",
        "./(all)/[workspaceSlug]/(settings)/settings/projects/[projectId]/labels/page.tsx"
      ),
      route(
        ":workspaceSlug/settings/projects/:projectId/estimates",
        "./(all)/[workspaceSlug]/(settings)/settings/projects/[projectId]/estimates/page.tsx"
      ),
      route(
        ":workspaceSlug/settings/projects/:projectId/automations",
        "./(all)/[workspaceSlug]/(settings)/settings/projects/[projectId]/automations/page.tsx"
      ),
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
        ":workspaceSlug/settings/billing",
        "./(all)/[workspaceSlug]/(settings)/settings/(workspace)/billing/page.tsx"
      ),
      route(":workspaceSlug/settings/projects", "./(all)/[workspaceSlug]/(settings)/settings/projects/page.tsx"),
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
      route(
        ":workspaceSlug/settings/members",
        "./(all)/[workspaceSlug]/(settings)/settings/(workspace)/members/page.tsx"
      ),
    ]),
    layout("./(all)/settings/profile/layout.tsx", [
      route("settings/profile/:profileTabId", "./(all)/settings/profile/[profileTabId]/page.tsx"),
    ]),
  ]),
  layout("./legacy-layout.tsx", [...coreRoutes, route("*", "./not-found.tsx")]),
];

export default routes;
