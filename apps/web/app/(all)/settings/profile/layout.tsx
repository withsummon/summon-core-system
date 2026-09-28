/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { Outlet } from "react-router";
import { SessionBoundary } from "@/components/convex-core/identity/session-boundary";

export default function ProfileSettingsLayout() {
  return (
    <SessionBoundary>
      <div className="relative flex size-full overflow-hidden bg-canvas p-2">
        <main className="relative flex size-full flex-col overflow-hidden rounded-lg border border-subtle bg-surface-1">
          <div className="size-full overflow-hidden">
            <Outlet />
          </div>
        </main>
      </div>
    </SessionBoundary>
  );
}
