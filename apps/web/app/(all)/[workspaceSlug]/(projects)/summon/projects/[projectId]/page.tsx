/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { useOutletContext, useParams, useNavigate } from "react-router";
import { useQuery } from "convex/react";
import { api } from "@summon/convex/api";
import type { WorkspaceSession } from "@/components/workspace/native-shell/session";
import { PreservedWorkspaceShell } from "@/components/workspace/native-shell/workspace-shell";
import { useStickiesCommands } from "@/components/stickies/native/provider";
import { ProjectBoundary } from "@/components/convex-core/projects/boundary";
import { ProjectDetailWorkspace } from "./project-detail-workspace";

export default function SummonProjectOverviewPage() {
  const session = useOutletContext<WorkspaceSession>();
  const commands = useStickiesCommands();
  const { projectId } = useParams();
  const navigate = useNavigate();
  return (
    <PreservedWorkspaceShell
      {...session}
      onCreateSticky={commands.create}
      onOpenStickies={commands.openAll}
      beforeLeave={commands.flushAll}
    >
      <ProjectBoundary key={projectId} onRecover={() => navigate(`/${session.workspace.slug}/summon/projects/`)}>
        <ProjectJourney projectId={projectId ?? ""} />
      </ProjectBoundary>
    </PreservedWorkspaceShell>
  );
}
function ProjectJourney({ projectId }: { projectId: string }) {
  const { workspace } = useOutletContext<WorkspaceSession>();
  const address = useQuery(api.navigation.address.resolveProjectId, { workspaceId: workspace._id, projectId });
  const overview = useQuery(api.reporting.overview.project, address ? { projectId: address.project._id } : "skip");
  if (!address || !overview)
    return (
      <p role="status" className="p-6">
        Loading project…
      </p>
    );
  return <ProjectDetailWorkspace overview={overview} address={address} />;
}
