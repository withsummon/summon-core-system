/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { Outlet, useNavigate, useOutletContext, useParams } from "react-router";
import { useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "@summon/convex/api";
import type { WorkspaceSession } from "@/components/workspace/native-shell/session";
import { ContentWrapper } from "@/components/core/content-wrapper";
import { useStickiesCommands } from "@/components/stickies/native/provider";
import { PreservedWorkspaceShell } from "@/components/workspace/native-shell/workspace-shell";
import { useTaskLifecycle } from "@/components/convex-core/tasks/lifecycle";

export type BrowseAddress = FunctionReturnType<typeof api.navigation.address.resolveTask>;
export type BrowseSession = {
  address: BrowseAddress | undefined;
  lifecycle: ReturnType<typeof useTaskLifecycle>;
};

export default function ProjectIssueDetailsLayout() {
  const session = useOutletContext<WorkspaceSession>();
  const { workItem } = useParams();
  const commands = useStickiesCommands();
  const navigate = useNavigate();
  const address = useQuery(
    api.navigation.address.resolveTask,
    workItem ? { workspaceSlug: session.workspace.slug, workItem } : "skip"
  );
  const lifecycle = useTaskLifecycle((operation, task) => {
    if (operation === "delete" || operation === "archive")
      navigate(
        `/${session.workspace.slug}/projects/${task.projectId}/${operation === "delete" && task.archivedAt !== null ? "archives/issues" : "issues"}/`
      );
  });
  return (
    <PreservedWorkspaceShell
      {...session}
      onCreateSticky={commands.create}
      onOpenStickies={commands.openAll}
      beforeLeave={commands.flushAll}
    >
      <ContentWrapper className="overflow-hidden">
        <Outlet context={{ address, lifecycle } satisfies BrowseSession} />
      </ContentWrapper>
    </PreservedWorkspaceShell>
  );
}
