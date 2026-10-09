/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useOutletContext } from "react-router";
// components
import { PageHead } from "@/components/core/page-title";
// hooks
import type { WorkspaceSession } from "@/components/workspace/native-shell/session";
// local imports
import { WorkspaceActiveCyclesUpgrade } from "@/components/active-cycles/workspace-active-cycles-upgrade";

export default function WorkspaceActiveCyclesPage() {
  const { workspace, user } = useOutletContext<WorkspaceSession>();
  // derived values
  const pageTitle = `${workspace.name} - Active Cycles`;

  return (
    <>
      <PageHead title={pageTitle} />
      <WorkspaceActiveCyclesUpgrade theme={user.preferences.theme.theme} />
    </>
  );
}
