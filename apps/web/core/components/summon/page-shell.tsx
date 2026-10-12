/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { Outlet, useLocation } from "react-router";

/**
 * Every Summon page rises in section by section (`page-rise`). Keying the outlet by path replays it when one
 * detail page opens another of the same route; hash tabs, search params and refetches keep the page mounted.
 */
export function SummonPageShell() {
  const { pathname } = useLocation();
  return (
    <div className="page-rise h-full min-h-0 overflow-x-hidden overflow-y-auto bg-surface-2">
      <Outlet key={pathname} />
    </div>
  );
}
