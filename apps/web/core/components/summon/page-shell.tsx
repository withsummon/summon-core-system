/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { Outlet, useParams } from "react-router";
import { useSummonAccess } from "@/components/summon/use-summon-access";

/**
 * Frame for every Summon page. Pages render their static parts immediately and skeletons where data goes; on a
 * page switch the content under the header rises in (`page-rise`) while the header stays still.
 *
 * Opening another route mounts its own page anyway. Keying the outlet by the route params also gives a detail page
 * fresh state when it opens another record of the same route, while routes that share a layout under the same
 * params (the Settings tabs) keep that layout mounted, so its tabs animate between them.
 */
export function SummonPageShell() {
  const params = useParams();
  // Load the capability map once with the shell, so gated pages already know who may see them when they open.
  useSummonAccess(params.workspaceSlug ?? "");
  return (
    <div className="page-rise h-full min-h-0 overflow-x-hidden overflow-y-auto bg-surface-2">
      <Outlet key={JSON.stringify(params)} />
    </div>
  );
}
