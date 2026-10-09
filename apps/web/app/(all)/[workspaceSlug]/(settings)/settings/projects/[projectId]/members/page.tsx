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
import { PageHead } from "@/components/core/page-title";
import { PreservedProjectSettingsShell } from "@/components/workspace/native-shell/workspace-shell";
import { useStickiesCommands } from "@/components/stickies/native/provider";
import { ProjectMemberList } from "@/components/project/member-list";
import { ProjectSettingsMemberDefaults } from "@/components/project/project-settings-member-defaults";
import { MembersSettingsLoader } from "@/components/ui/loader/settings/members";
import { SettingsHeading } from "@/components/settings/heading";
import { MembersProjectSettingsHeader } from "./header";
export { ProjectFeatureSettingsErrorBoundary as ErrorBoundary } from "@/components/settings/project/content/feature-control-item";

export default function MembersSettingsPage() {
  const session = useOutletContext<WorkspaceSession>();
  const { projectId } = useParams();
  const { t } = useTranslation();
  const commands = useStickiesCommands();
  const project = useQuery(
    api.projects.features.resolve,
    projectId ? { workspaceId: session.workspace._id, projectId } : "skip"
  );
  if (!project) return <MembersSettingsLoader />;
  return (
    <PreservedProjectSettingsShell
      {...session}
      project={project}
      authorized={project.role !== "guest"}
      activePath="common.members"
      header={<MembersProjectSettingsHeader />}
      hugging
    >
      <PageHead title={`${project.name} - Members`} />
      <SettingsHeading title={t("common.members")} />
      {project.role !== "guest" && (
        <>
          <ProjectSettingsMemberDefaults key={`defaults-${project.projectId}`} projectId={project.projectId} />
          <ProjectMemberList
            key={project.projectId}
            projectId={project.projectId}
            projectName={project.name}
            workspaceSlug={session.workspace.slug}
            beforeLeave={commands.flushAll}
          />
        </>
      )}
    </PreservedProjectSettingsShell>
  );
}
