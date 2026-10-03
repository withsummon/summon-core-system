/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useEffect, useMemo } from "react";
import { observer } from "mobx-react";
import useSWR from "swr";
import { summonService } from "@/services/summon.service";
import { SummonRequestState } from "@/components/summon/request-state";
import { useCommandPalette } from "@/hooks/store/use-command-palette";
import { useProject } from "@/hooks/store/use-project";
import { mergeProjectSummaries } from "./project-workspace";
import { ProjectsPortfolio } from "./projects-portfolio";
interface IProjectsDirectoryRootProps {
  workspaceSlug: string;
}
export const ProjectsDirectoryRoot = observer(function ProjectsDirectoryRoot({
  workspaceSlug,
}: IProjectsDirectoryRootProps) {
  const { toggleCreateProjectModal } = useCommandPalette();
  const { joinedProjectIds, getProjectById } = useProject();
  const { data, error, isLoading, mutate } = useSWR(["summon-projects", workspaceSlug], () =>
    summonService.getHomeSummary(workspaceSlug)
  );

  const storeProjects = joinedProjectIds.map((id) => getProjectById(id)).filter((project) => project !== undefined);
  const allProjects = useMemo(
    () => mergeProjectSummaries(data?.projects ?? [], storeProjects),
    [data?.projects, storeProjects]
  );

  useEffect(() => {
    if (data && allProjects.length > data.projects.length) void mutate();
  }, [allProjects.length, data, mutate]);

  if (!data) return <SummonRequestState loading={isLoading} error={error} onRetry={() => void mutate()} />;
  return (
    <ProjectsPortfolio
      workspaceSlug={workspaceSlug}
      allProjects={allProjects}
      onCreateProject={() => toggleCreateProjectModal(true)}
    />
  );
});
