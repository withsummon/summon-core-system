/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import useSWR from "swr";
// plane imports
import type { TIssue } from "@plane/types";
// hooks
import { useIssueDetail } from "@/hooks/store/use-issue-detail";
import { useProject } from "@/hooks/store/use-project";

/** Resolves a `PROJECT-123` work item identifier to its fetched issue and project. */
export const useWorkItemByIdentifier = (workspaceSlug: string, workItem: string) => {
  // store hooks
  const {
    fetchIssueWithIdentifier,
    issue: { getIssueById },
  } = useIssueDetail();
  const { getProjectById, getProjectByIdentifier } = useProject();

  const [projectIdentifier, sequence_id] = workItem.split("-");

  // fetching issue details
  const { data, isLoading, error } = useSWR<TIssue, Error>(
    `ISSUE_DETAIL_${workspaceSlug}_${projectIdentifier}_${sequence_id}`,
    () => fetchIssueWithIdentifier(workspaceSlug.toString(), projectIdentifier, sequence_id)
  );

  // derived values
  const projectDetails = getProjectByIdentifier(projectIdentifier);
  const issueId = data?.id;
  const projectId = data?.project_id ?? projectDetails?.id ?? "";
  const issue = getIssueById(issueId?.toString() || "") || undefined;
  const project = (issue?.project_id && getProjectById(issue?.project_id)) || undefined;
  const pageTitle = project && issue ? `${project?.identifier}-${issue?.sequence_id} ${issue?.name}` : undefined;

  return { data, isLoading, error, issue, issueId, projectId, pageTitle };
};
