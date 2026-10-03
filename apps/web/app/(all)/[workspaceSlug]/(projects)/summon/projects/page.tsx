/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { ProjectsDirectoryRoot } from "@/components/summon/projects";
import { useOutletContext } from "react-router";
import type { WorkspaceSession } from "@/components/workspace/native-shell/session";
import { PreservedWorkspaceShell } from "@/components/workspace/native-shell/workspace-shell";
import { useStickiesCommands } from "@/components/stickies/native/provider";

export default function SummonProjectsPage() {
  const session = useOutletContext<WorkspaceSession>();
  const commands = useStickiesCommands();
  return (
    <PreservedWorkspaceShell
      {...session}
      onCreateSticky={commands.create}
      onOpenStickies={commands.openAll}
      beforeLeave={commands.flushAll}
    >
      <ProjectsDirectoryRoot workspaceSlug={session.workspace.slug} />
    </PreservedWorkspaceShell>
  );
}
