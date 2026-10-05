/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */
import { Outlet, useOutletContext, useParams } from "react-router";
import { useQuery } from "convex/react";
import { api } from "@summon/convex/api";
import { Row } from "@plane/ui";
import type { WorkspaceSession } from "@/components/workspace/native-shell/session";
import { ContentWrapper } from "@/components/core/content-wrapper";
import { PreservedWorkspaceShell } from "@/components/workspace/native-shell/workspace-shell";
import { useStickiesCommands } from "@/components/stickies/native/provider";
import { ProjectAutomationHeader } from "./header";
export default function ProjectAutomationLayout() {
  const session = useOutletContext<WorkspaceSession>();
  const { projectId } = useParams();
  const commands = useStickiesCommands();
  const address = useQuery(
    api.navigation.address.resolveProjectId,
    projectId ? { workspaceId: session.workspace._id, projectId } : "skip"
  );
  return (
    <PreservedWorkspaceShell
      {...session}
      onCreateSticky={commands.create}
      onOpenStickies={commands.openAll}
      beforeLeave={commands.flushAll}
    >
      {!address ? (
        <p role="status" className="p-6">
          Loading automation…
        </p>
      ) : (
        <div className="flex h-full min-h-0 flex-col">
          <Row className="z-[18] flex min-h-11 shrink-0 items-center border-b border-subtle bg-surface-1">
            <ProjectAutomationHeader address={address} />
          </Row>
          <ContentWrapper>
            <Outlet context={address} />
          </ContentWrapper>
        </div>
      )}
    </PreservedWorkspaceShell>
  );
}
