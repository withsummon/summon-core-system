/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useEffect } from "react";
import { observer } from "mobx-react";
// plane imports
import { EIssueServiceType } from "@plane/types";
// components
import { PageHead } from "@/components/core/page-title";
// hooks
import { useAppRouter } from "@/hooks/use-app-router";
// layouts
import { ProjectAuthWrapper } from "@/layouts/auth-layout/project-wrapper";
// plane web imports
import { useWorkItemProperties } from "@/hooks/use-issue-properties";
import { WorkItemDetailRoot } from "@/components/browse/workItem-detail";

import type { Route } from "./+types/page";
import { useResponsiveIssueDetailSidebar } from "./use-responsive-issue-detail-sidebar";
import { useWorkItemByIdentifier } from "./use-work-item-by-identifier";
import { WorkItemDetailLoader, WorkItemNotFound } from "./work-item-detail-states";

export const IssueDetailsPage = observer(function IssueDetailsPage({ params }: Route.ComponentProps) {
  // router
  const router = useAppRouter();
  const { workspaceSlug, workItem } = params;
  const { data, isLoading, error, issue, issueId, projectId, pageTitle } = useWorkItemByIdentifier(
    workspaceSlug,
    workItem
  );

  useWorkItemProperties(
    projectId,
    workspaceSlug.toString(),
    issueId,
    issue?.is_epic ? EIssueServiceType.EPICS : EIssueServiceType.ISSUES
  );

  useResponsiveIssueDetailSidebar();

  useEffect(() => {
    if (data?.is_intake) {
      router.push(`/${workspaceSlug}/projects/${data.project_id}/intake/?currentTab=open&inboxIssueId=${data?.id}`);
    }
  }, [workspaceSlug, data, router]);

  if (error && !isLoading) return <WorkItemNotFound workspaceSlug={workspaceSlug} />;

  if (!issue || isLoading) return <WorkItemDetailLoader />;

  return (
    <>
      <PageHead title={pageTitle} />
      {workspaceSlug && projectId && issueId && (
        <ProjectAuthWrapper workspaceSlug={workspaceSlug} projectId={projectId}>
          <WorkItemDetailRoot
            workspaceSlug={workspaceSlug.toString()}
            projectId={projectId.toString()}
            issueId={issueId.toString()}
            issue={issue}
          />
        </ProjectAuthWrapper>
      )}
    </>
  );
});

export default IssueDetailsPage;
