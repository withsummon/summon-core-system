/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { Outlet, useOutletContext } from "react-router";
import { PreservedWorkspaceShell } from "@/components/workspace/native-shell/workspace-shell";
import type { WorkspaceSession } from "@/components/workspace/native-shell/session";
import { useStickiesCommands } from "@/components/stickies/native/provider";
import { ContentWrapper } from "@/components/core/content-wrapper";
import { Row } from "@plane/ui";
import { WorkspaceAnalyticsHeader } from "./header";
export default function WorkspaceAnalyticsTabLayout() {
  const session = useOutletContext<WorkspaceSession>();
  const commands = useStickiesCommands();
  return (
    <PreservedWorkspaceShell
      {...session}
      onCreateSticky={commands.create}
      onOpenStickies={commands.openAll}
      beforeLeave={commands.flushAll}
    >
      <Row>
        <WorkspaceAnalyticsHeader />
      </Row>
      <ContentWrapper>
        <Outlet context={session} />
      </ContentWrapper>
    </PreservedWorkspaceShell>
  );
}
