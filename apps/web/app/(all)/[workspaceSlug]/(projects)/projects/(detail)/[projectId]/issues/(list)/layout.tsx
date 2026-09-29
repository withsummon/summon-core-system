/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

// components
import { useCallback, useState } from "react";
import { Outlet, useOutletContext, useParams } from "react-router";
import { useQuery } from "convex/react";
import { api } from "@summon/convex/api";
import { Row } from "@plane/ui";
import type { WorkspaceSession } from "@/app/native-workspace";
import { ContentWrapper } from "@/components/core/content-wrapper";
import { PreservedWorkspaceShell } from "@/components/workspace/native-shell/workspace-shell";
import { useStickiesCommands } from "@/components/stickies/native/provider";
import useKeypress from "@/hooks/use-keypress";
import { CreateProjectIssue } from "@/components/convex-core/tasks/task-detail";
import { ProjectIssuesHeader } from "./header";

export default function ProjectIssuesLayout() {
  const session = useOutletContext<WorkspaceSession>();
  const { projectId } = useParams();
  const commands = useStickiesCommands();
  const address = useQuery(
    api.navigation.address.resolveProjectId,
    projectId ? { workspaceId: session.workspace._id, projectId } : "skip"
  );
  const states = useQuery(api.tasks.states.list, address ? { projectId: address.project._id } : "skip");
  const [creating, setCreating] = useState(false);
  const close = useCallback(() => setCreating(false), []);
  const canCreate = address && address.projectRole !== "guest" && address.workspaceRole !== "guest";
  useKeypress("c", (event) => {
    if (!canCreate || event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey)
      return;
    if (
      event.target instanceof HTMLElement &&
      event.target.closest("input, textarea, select, [contenteditable], [role=dialog]")
    )
      return;
    event.preventDefault();
    setCreating(true);
  });
  return (
    <PreservedWorkspaceShell
      {...session}
      onCreateSticky={commands.create}
      onOpenStickies={commands.openAll}
      beforeLeave={commands.flushAll}
    >
      {!address ? (
        <p role="status" className="p-6">
          Loading work items…
        </p>
      ) : (
        <div className="flex h-full min-h-0 flex-col">
          <Row className="z-[18] flex h-11 shrink-0 items-center gap-2 border-b border-subtle bg-surface-1">
            <ProjectIssuesHeader address={address} onCreate={canCreate ? () => setCreating(true) : undefined} />
          </Row>
          <ContentWrapper>
            <Outlet context={address} />
          </ContentWrapper>
          {creating && canCreate && states && (
            <CreateProjectIssue key={address.project._id} address={address} states={states} onClose={close} />
          )}
        </div>
      )}
    </PreservedWorkspaceShell>
  );
}
