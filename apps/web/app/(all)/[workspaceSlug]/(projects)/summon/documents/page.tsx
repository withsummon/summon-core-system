/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { DocumentsRoot } from "@/components/summon/documents";
import { useOutletContext } from "react-router";
import type { WorkspaceSession } from "@/components/workspace/native-shell/session";
import { PreservedWorkspaceShell } from "@/components/workspace/native-shell/workspace-shell";
import { useStickiesCommands } from "@/components/stickies/native/provider";

export default function SummonDocumentsPage() {
  const session = useOutletContext<WorkspaceSession>();
  const commands = useStickiesCommands();
  return (
    <PreservedWorkspaceShell
      {...session}
      onCreateSticky={commands.create}
      onOpenStickies={commands.openAll}
      beforeLeave={commands.flushAll}
    >
      <DocumentsRoot workspaceSlug={session.workspace.slug} />
    </PreservedWorkspaceShell>
  );
}
