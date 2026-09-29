/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";
import { observer } from "mobx-react";
// plane imports
import { ROLE_DETAILS } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
import { Logo } from "@plane/propel/emoji-icon-picker";
import { IconButton } from "@plane/propel/icon-button";
// hooks
import { useUserPermissions } from "@/hooks/store/user";
import { useAppRouter } from "@/hooks/use-app-router";
import { useProject } from "@/hooks/store/use-project";
import { useWorkspace } from "@/hooks/store/use-workspace";

type Props = {
  projectId: string;
};

export const ProjectSettingsSidebarHeader = observer(function ProjectSettingsSidebarHeader(props: Props) {
  const { projectId } = props;
  // router
  const router = useAppRouter();
  // store hooks
  const { getProjectRoleByWorkspaceSlugAndProjectId } = useUserPermissions();
  const { currentWorkspace } = useWorkspace();
  const { getPartialProjectById } = useProject();
  // derived values
  const projectDetails = getPartialProjectById(projectId);
  const currentProjectRole = currentWorkspace?.slug
    ? getProjectRoleByWorkspaceSlugAndProjectId(currentWorkspace.slug, projectId)
    : undefined;
  // translation
  const { t } = useTranslation();

  if (!currentProjectRole) return null;

  return (
    <ProjectSettingsSidebarHeaderView
      name={projectDetails?.name}
      roleLabel={t(ROLE_DETAILS[currentProjectRole].i18n_title)}
      logo={<Logo logo={projectDetails?.logo_props} size={20} />}
      onGoBack={() => router.push(`/${currentWorkspace?.slug}/projects/${projectId}/issues/`)}
    />
  );
});

export function ProjectSettingsSidebarHeaderView({
  name,
  roleLabel,
  logo,
  onGoBack,
}: {
  name: string | undefined;
  roleLabel: string;
  logo: ReactNode;
  onGoBack: () => void;
}) {
  return (
    <div className="shrink-0">
      <div className="flex items-center gap-1 py-3 pr-5 pl-4 text-body-md-medium">
        <IconButton variant="ghost" size="base" icon={ArrowLeft} onClick={onGoBack} aria-label="Back to project" />
        <p>Project settings</p>
      </div>
      <div className="mt-1.5 flex items-center gap-2 truncate px-5 py-0.5">
        <div className="grid size-8 shrink-0 place-items-center rounded bg-layer-2">{logo}</div>
        <div className="truncate">
          <p className="truncate text-body-sm-medium">{name}</p>
          <p className="truncate text-caption-md-regular">{roleLabel}</p>
        </div>
      </div>
    </div>
  );
}
