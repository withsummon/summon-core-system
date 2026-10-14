/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
// plane imports
import { Tooltip } from "@plane/propel/tooltip";
import type { TIssue, TIssueServiceType, TSubIssueOperations } from "@plane/types";
import { EIssueServiceType, EIssuesStoreType } from "@plane/types";
import { ControlLink } from "@plane/ui";
import { generateWorkItemLink } from "@plane/utils";
// helpers
import { WithDisplayPropertiesHOC } from "@/components/issues/issue-layouts/properties/with-display-properties-HOC";
// hooks
import { useIssueDetail } from "@/hooks/store/use-issue-detail";
import { useProject } from "@/hooks/store/use-project";
import useIssuePeekOverviewRedirection from "@/hooks/use-issue-peek-overview-redirection";
import { usePlatformOS } from "@/hooks/use-platform-os";
// components
import { IssueIdentifier } from "@/components/issues/issue-detail/issue-identifier";
// local components
import { SubIssueExpandToggle, SubIssueItemMenu } from "./list-item-controls";
import { SubIssuesListItemProperties } from "./properties";
import { SubIssuesListRoot } from "./root";

type Props = {
  workspaceSlug: string;
  projectId: string;
  parentIssueId: string;
  rootIssueId: string;
  spacingLeft: number;
  canEdit: boolean;
  handleIssueCrudState: (
    key: "create" | "existing" | "update" | "delete",
    issueId: string,
    issue?: TIssue | null
  ) => void;
  subIssueOperations: TSubIssueOperations;
  issueId: string;
  issueServiceType?: TIssueServiceType;
  storeType?: EIssuesStoreType;
};

export const SubIssuesListItem = observer(function SubIssuesListItem(props: Props) {
  const {
    workspaceSlug,
    projectId,
    parentIssueId,
    rootIssueId,
    issueId,
    spacingLeft = 10,
    canEdit,
    handleIssueCrudState,
    subIssueOperations,
    issueServiceType = EIssueServiceType.ISSUES,
    storeType = EIssuesStoreType.PROJECT,
  } = props;
  const {
    issue: { getIssueById },
    subIssues: {
      filters: { getSubIssueFilters },
    },
  } = useIssueDetail(issueServiceType);
  const {
    subIssues: { subIssueHelpersByIssueId },
  } = useIssueDetail();
  const project = useProject();
  const { handleRedirection } = useIssuePeekOverviewRedirection();
  const { isMobile } = usePlatformOS();
  const issue = getIssueById(issueId);

  // derived values
  const projectDetail = issue?.project_id ? project.getProjectById(issue.project_id) : undefined;

  const subIssueHelpers = subIssueHelpersByIssueId(parentIssueId);
  const subIssueCount = issue?.sub_issues_count ?? 0;

  // derived values
  const subIssueFilters = getSubIssueFilters(parentIssueId);
  const displayProperties = subIssueFilters?.displayProperties ?? {};

  //
  const handleIssuePeekOverview = (issue: TIssue) => handleRedirection(workspaceSlug, issue, isMobile);

  if (!issue) return <></>;

  // check if current issue is the root issue
  const isCurrentIssueRoot = issueId === rootIssueId;

  const workItemLink = generateWorkItemLink({
    workspaceSlug,
    projectId: issue?.project_id,
    issueId: issue?.id,
    projectIdentifier: projectDetail?.identifier,
    sequenceId: issue?.sequence_id,
  });

  return (
    <div key={issueId}>
      <ControlLink
        id={`issue-${issue.id}`}
        href={workItemLink}
        onClick={() => handleIssuePeekOverview(issue)}
        className="w-full cursor-pointer"
      >
        <div
          className="group relative flex h-full min-h-11 w-full items-center py-1 pr-2 transition-colors hover:bg-surface-2"
          style={{ paddingLeft: `${spacingLeft}px` }}
        >
          <div className="flex size-5 flex-shrink-0 items-center justify-center">
            {/* disable the chevron when current issue is also the root issue*/}
            {subIssueCount > 0 && !isCurrentIssueRoot && (
              <SubIssueExpandToggle
                workspaceSlug={workspaceSlug}
                projectId={projectId}
                parentIssueId={parentIssueId}
                issueId={issueId}
              />
            )}
          </div>

          <div className="flex w-full cursor-pointer items-center gap-3 truncate">
            <WithDisplayPropertiesHOC displayProperties={displayProperties} displayPropertyKey="key">
              <div className="flex-shrink-0">
                {projectDetail && (
                  <IssueIdentifier
                    projectId={projectDetail.id}
                    issueTypeId={issue.type_id}
                    projectIdentifier={projectDetail.identifier}
                    issueSequenceId={issue.sequence_id}
                    size="xs"
                    variant="secondary"
                  />
                )}
              </div>
            </WithDisplayPropertiesHOC>
            <Tooltip tooltipContent={issue.name} isMobile={isMobile}>
              <span className="w-0 flex-1 truncate text-13 text-primary">{issue.name}</span>
            </Tooltip>
          </div>

          <div
            className="flex-shrink-0 text-13"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
          >
            <SubIssuesListItemProperties
              workspaceSlug={workspaceSlug}
              parentIssueId={parentIssueId}
              issueId={issueId}
              canEdit={canEdit}
              updateSubIssue={subIssueOperations.updateSubIssue}
              displayProperties={displayProperties}
              issue={issue}
            />
          </div>

          <div className="flex-shrink-0 text-13">
            <SubIssueItemMenu
              workspaceSlug={workspaceSlug}
              parentIssueId={parentIssueId}
              issue={issue}
              workItemLink={workItemLink}
              canEdit={canEdit}
              handleIssueCrudState={handleIssueCrudState}
              subIssueOperations={subIssueOperations}
              issueServiceType={issueServiceType}
            />
          </div>
        </div>
      </ControlLink>

      {/* should not expand the current issue if it is also the root issue*/}
      {subIssueHelpers.issue_visibility.includes(issueId) &&
        issue.project_id &&
        subIssueCount > 0 &&
        !isCurrentIssueRoot && (
          <SubIssuesListRoot
            storeType={storeType}
            workspaceSlug={workspaceSlug}
            projectId={issue.project_id}
            parentIssueId={issue.id}
            rootIssueId={rootIssueId}
            spacingLeft={spacingLeft + 22}
            canEdit={canEdit}
            handleIssueCrudState={handleIssueCrudState}
            subIssueOperations={subIssueOperations}
          />
        )}
    </div>
  );
});
