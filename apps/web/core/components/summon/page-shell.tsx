/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { Outlet, useLocation, useParams } from "react-router";
import { useSummonAccess } from "@/components/summon/use-summon-access";

/**
 * Frame for every Summon page. Pages render their static parts immediately and skeletons where data goes; on a
 * page switch the content under the header rises in (`page-rise`) while the header stays still. Keying the outlet
 * by path replays that when one detail page opens another of the same route; hash tabs, search params and
 * refetches keep the page mounted.
 */
export function SummonPageShell() {
  const { pathname } = useLocation();
  const { workspaceSlug = "" } = useParams();
  // Load the capability map once with the shell, so gated pages already know who may see them when they open.
  useSummonAccess(workspaceSlug);
  return (
    <div className="page-rise h-full min-h-0 overflow-x-hidden overflow-y-auto bg-surface-2">
      <Outlet key={pathname} />
    </div>
  );
}
