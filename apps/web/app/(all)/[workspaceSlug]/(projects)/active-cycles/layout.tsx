/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

// components
import { Outlet, useOutletContext } from "react-router";
import { PreservedWorkspaceShell } from "@/components/workspace/native-shell/workspace-shell";
import { useStickiesCommands } from "@/components/stickies/native/provider";
import type { WorkspaceSession } from "@/components/workspace/native-shell/session";
import { AppHeader } from "@/components/core/app-header";
import { ContentWrapper } from "@/components/core/content-wrapper";
// local imports
import { WorkspaceActiveCycleHeader } from "./header";

export default function WorkspaceActiveCycleLayout() {
  const session = useOutletContext<WorkspaceSession>();
  const commands = useStickiesCommands();
  return (
    <PreservedWorkspaceShell
      {...session}
      onCreateSticky={commands.create}
      onOpenStickies={commands.openAll}
      beforeLeave={commands.flushAll}
    >
      <AppHeader header={<WorkspaceActiveCycleHeader />} />
      <ContentWrapper>
        <Outlet context={session} />
      </ContentWrapper>
    </PreservedWorkspaceShell>
  );
}
