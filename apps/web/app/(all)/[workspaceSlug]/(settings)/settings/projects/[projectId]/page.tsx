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
import { ProjectDetailsForm } from "@/components/project/form";
import { ProjectDetailsFormLoader } from "@/components/project/form-loader";
import { PreservedProjectSettingsShell } from "@/components/workspace/native-shell/workspace-shell";
import { GeneralProjectSettingsHeader } from "./header";

export { ProjectFeatureSettingsErrorBoundary as ErrorBoundary } from "@/components/settings/project/content/feature-control-item";

export default function ProjectSettingsPage() {
  const session = useOutletContext<WorkspaceSession>();
  const { projectId } = useParams();
  const settings = useQuery(
    api.projects.form.get,
    projectId ? { workspaceId: session.workspace._id, projectId } : "skip"
  );
  if (!settings) return <ProjectDetailsFormLoader />;
  return (
    <PreservedProjectSettingsShell
      {...session}
      project={settings.shell}
      authorized
      activePath="common.general"
      header={<GeneralProjectSettingsHeader />}
    >
      <PageHead title={`${settings.input.name} - General Settings`} />
      <div className={`w-full ${settings.canManage ? "" : "opacity-60"}`}>
        <ProjectDetailsForm key={settings.input.projectId} project={settings} workspaceSlug={session.workspace.slug} />
      </div>
    </PreservedProjectSettingsShell>
  );
}
