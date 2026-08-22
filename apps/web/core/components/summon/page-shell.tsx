/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { Outlet } from "react-router";

export function SummonPageShell() {
  return (
    <div className="h-full min-h-0 overflow-y-auto bg-surface-2">
      <Outlet />
    </div>
  );
}
