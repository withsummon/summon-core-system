/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */
import { nativeStickiesRoute } from "./ownership";
import { layout, route } from "@react-router/dev/routes";
import type { RouteConfig, RouteConfigEntry } from "@react-router/dev/routes";

export const coreRoutes: RouteConfigEntry[] = [
  layout("./(all)/layout.tsx", [
    layout("./(all)/[workspaceSlug]/layout.tsx", [
      layout("./(all)/[workspaceSlug]/(projects)/layout.tsx", [
        layout("./(all)/[workspaceSlug]/(projects)/analytics/[tabId]/layout.tsx", [
          route(":workspaceSlug/analytics/:tabId", "./(all)/[workspaceSlug]/(projects)/analytics/[tabId]/page.tsx"),
        ]),
        ...(nativeStickiesRoute
          ? []
          : [
              layout("./(all)/[workspaceSlug]/(projects)/stickies/layout.tsx", [
                route(":workspaceSlug/stickies", "./(all)/[workspaceSlug]/(projects)/stickies/page.tsx"),
              ]),
            ]),
      ]),
    ]),
  ]),
  route(":workspaceSlug/analytics", "routes/redirects/core/analytics.tsx"),
] satisfies RouteConfig;
