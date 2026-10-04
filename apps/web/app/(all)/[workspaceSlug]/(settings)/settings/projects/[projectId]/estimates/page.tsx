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
import { EstimateRoot } from "@/components/estimates";
import { EstimateLoaderScreen } from "@/components/estimates/loader-screen";
import { PreservedProjectSettingsShell } from "@/components/workspace/native-shell/workspace-shell";
import { EstimatesProjectSettingsHeader } from "./header";
export { ProjectFeatureSettingsErrorBoundary as ErrorBoundary } from "@/components/settings/project/content/feature-control-item";

export default function EstimatesSettingsPage() {
  const session = useOutletContext<WorkspaceSession>();
  const { projectId } = useParams();
  const project = useQuery(
    api.projects.features.resolve,
    projectId ? { workspaceId: session.workspace._id, projectId } : "skip"
  );
  if (!project) return <EstimateLoaderScreen />;
  return (
    <PreservedProjectSettingsShell
      {...session}
      project={project}
      authorized={project.role !== "guest"}
      activePath="common.estimates"
      header={<EstimatesProjectSettingsHeader />}
    >
      <PageHead title={`${project.name} - Estimates`} />
      <EstimateRoot key={project.projectId} projectId={project.projectId} />
    </PreservedProjectSettingsShell>
  );
}
