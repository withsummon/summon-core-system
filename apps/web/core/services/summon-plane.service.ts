/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import type { TIssue, TPage } from "@plane/types";
import { IssueService } from "@/services/issue";
import { ProjectPageService } from "@/services/page";
import { summonService } from "@/services/summon.service";
import { listAllCursorResults } from "./summon-pagination";

type TAccessibleProject = { id: string; identifier: string; name: string };

export type TPlanePageIndexItem = { page: TPage; project: TAccessibleProject };

const issueService = new IssueService();
const pageService = new ProjectPageService();

export async function getAccessibleProjects(workspaceSlug: string): Promise<TAccessibleProject[]> {
  const summary = await summonService.getHomeSummary(workspaceSlug);
  return summary.projects;
}

export async function listAccessiblePlaneIssues(workspaceSlug: string): Promise<TIssue[]> {
  const projects = await getAccessibleProjects(workspaceSlug);
  const responses = await Promise.all(
    projects.map((project) =>
      listAllCursorResults<TIssue>((cursor) =>
        issueService.getIssues(workspaceSlug, project.id, cursor ? { cursor } : undefined)
      )
    )
  );
  return responses.flat();
}

export async function listAccessiblePlanePages(workspaceSlug: string): Promise<TPlanePageIndexItem[]> {
  const projects = await getAccessibleProjects(workspaceSlug);
  const pagesByProject = await Promise.all(
    projects.map(async (project) => ({ project, pages: await pageService.fetchAll(workspaceSlug, project.id) }))
  );
  return pagesByProject.flatMap(({ project, pages }) => pages.map((page) => ({ page, project })));
}
