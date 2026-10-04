/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useOutletContext, useParams } from "react-router";
import { useQuery } from "convex/react";
import { api } from "@summon/convex/api";
import { useTranslation } from "@plane/i18n";
import type { WorkspaceSession } from "@/components/workspace/native-shell/session";
import { PreservedProjectSettingsShell } from "@/components/workspace/native-shell/workspace-shell";
import { PageHead } from "@/components/core/page-title";
import { ProjectStateRoot, ProjectStateLoader } from "@/components/project-states";
import { SettingsHeading } from "@/components/settings/heading";
import { StatesProjectSettingsHeader } from "./header";
export { ProjectFeatureSettingsErrorBoundary as ErrorBoundary } from "@/components/settings/project/content/feature-control-item";

export default function StatesSettingsPage() {
  const session = useOutletContext<WorkspaceSession>();
  const { projectId } = useParams();
  const { t } = useTranslation();
  const project = useQuery(
    api.projects.features.resolve,
    projectId ? { workspaceId: session.workspace._id, projectId } : "skip"
  );
  if (!project) return <ProjectStateLoader />;
  return (
    <PreservedProjectSettingsShell
      {...session}
      project={project}
      authorized={project.role !== "guest"}
      activePath="common.states"
      header={<StatesProjectSettingsHeader />}
    >
      <PageHead title={`${project.name} - States`} />
      <SettingsHeading
        title={t("project_settings.states.heading")}
        description={t("project_settings.states.description")}
      />
      {project.role !== "guest" && (
        <div className="mt-6">
          <ProjectStateRoot key={project.projectId} project={project} />
        </div>
      )}
    </PreservedProjectSettingsShell>
  );
}
