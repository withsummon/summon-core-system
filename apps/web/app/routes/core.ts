/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { nativeStickiesRoute } from "./ownership";
import { layout, route } from "@react-router/dev/routes";
import type { RouteConfig, RouteConfigEntry } from "@react-router/dev/routes";

export const coreRoutes: RouteConfigEntry[] = nativeStickiesRoute
  ? []
  : ([
      layout("./(all)/layout.tsx", [
        layout("./(all)/[workspaceSlug]/layout.tsx", [
          layout("./(all)/[workspaceSlug]/(projects)/layout.tsx", [
            layout("./(all)/[workspaceSlug]/(projects)/stickies/layout.tsx", [
              route(":workspaceSlug/stickies", "./(all)/[workspaceSlug]/(projects)/stickies/page.tsx"),
            ]),
          ]),
        ]),
      ]),
    ] satisfies RouteConfig);
