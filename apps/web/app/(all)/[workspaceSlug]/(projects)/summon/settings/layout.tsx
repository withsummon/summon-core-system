/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { Outlet, useLocation } from "react-router";
import { SummonSettingsFrame } from "@/components/summon/settings/settings-frame";
import type { Route } from "./+types/layout";

export default function SummonSettingsLayout({ params }: Route.ComponentProps) {
  const { pathname } = useLocation();
  const tab = /\/settings\/users\/?$/.test(pathname) ? "users" : "general";
  return (
    <SummonSettingsFrame workspaceSlug={params.workspaceSlug} tab={tab}>
      <Outlet />
    </SummonSettingsFrame>
  );
}
