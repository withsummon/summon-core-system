/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useOutletContext, useParams } from "react-router";
import { useQuery } from "convex/react";
import { api } from "@summon/convex/api";
import type { WorkspaceSession } from "@/components/workspace/native-shell/session";
import { PageHead } from "@/components/core/page-title";
import { LabelManagement } from "@/components/convex-core/tasks/label-management";
import { PreservedProjectSettingsShell } from "@/components/workspace/native-shell/workspace-shell";
import { Loader } from "@plane/ui";
import { LabelsProjectSettingsHeader } from "./header";
export { ProjectFeatureSettingsErrorBoundary as ErrorBoundary } from "@/components/settings/project/content/feature-control-item";

export default function LabelsSettingsPage() {
  const session = useOutletContext<WorkspaceSession>();
  const { projectId } = useParams();
  const project = useQuery(
    api.projects.features.resolve,
    projectId ? { workspaceId: session.workspace._id, projectId } : "skip"
  );
  if (!project)
    return (
      <Loader>
        <Loader.Item height="42px" />
      </Loader>
    );
  return (
    <PreservedProjectSettingsShell
      {...session}
      project={project}
      authorized={project.role !== "guest"}
      activePath="common.labels"
      header={<LabelsProjectSettingsHeader />}
    >
      <PageHead title={`${project.name} - Labels`} />
      <LabelManagement key={project.projectId} projectId={project.projectId} />
    </PreservedProjectSettingsShell>
  );
}
