// oxlint-disable no-shadow
/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useEffect, useRef, useState } from "react";
import { observer } from "mobx-react";
// plane imports
import type { EditorRefApi } from "@plane/editor";
import type { TNameDescriptionLoader } from "@plane/types";
import { EFileAssetType, EIssueServiceType } from "@plane/types";
// components
import { DescriptionVersionsRoot } from "@/components/core/description-versions";
import { DescriptionInput } from "@/components/editor/rich-text/description-input";
import { IssueTypeSwitcher } from "@/components/issues/issue-type-switcher";
// hooks
import { useIssueDetail } from "@/hooks/store/use-issue-detail";
import { useMember } from "@/hooks/store/use-member";
import { useUser } from "@/hooks/store/user";
import useReloadConfirmations from "@/hooks/use-reload-confirmation";
import useSize from "@/hooks/use-window-size";
// services
import { WorkItemVersionService } from "@/services/issue";
// local imports
import { IssueDetailWidgets } from "../issue-detail-widgets";
import { NameDescriptionUpdateStatus, nameDescriptionStatus } from "../issue-update-status";
import { PeekOverviewProperties } from "../peek-overview/properties";
import { IssueTitleInput } from "../title-input";
import { IssueActivity } from "./issue-activity";
import { IssueParentDetail } from "./parent";
import { IssueReaction } from "./reactions";
import type { TIssueOperations } from "./root";
// services init
const workItemVersionService = new WorkItemVersionService();

type Props = {
  workspaceSlug: string;
  projectId: string;
  issueId: string;
  issueOperations: TIssueOperations;
  isEditable: boolean;
  isArchived: boolean;
};

export const IssueMainContent = observer(function IssueMainContent(props: Props) {
  const { workspaceSlug, projectId, issueId, issueOperations, isEditable, isArchived } = props;
  // refs
  const editorRef = useRef<EditorRefApi>(null);
  // states
  const [titleStatus, setTitleStatus] = useState<TNameDescriptionLoader>("saved");
  const [descriptionStatus, setDescriptionStatus] = useState<TNameDescriptionLoader>("saved");
  const isSubmitting = nameDescriptionStatus(titleStatus, descriptionStatus);
  // hooks
  const windowSize = useSize();
  const { data: currentUser } = useUser();
  const { getUserDetails } = useMember();
  const {
    issue: { getIssueById },
    peekIssue,
  } = useIssueDetail();
  useReloadConfirmations(isSubmitting === "submitting" || isSubmitting === "failed");
  // derived values
  const issue = issueId ? getIssueById(issueId) : undefined;

  useEffect(() => {
    if (isSubmitting !== "submitted") return;
    const timer = setTimeout(() => {
      setTitleStatus("saved");
      setDescriptionStatus("saved");
    }, 2000);
    return () => clearTimeout(timer);
  }, [isSubmitting]);

  if (!issue || !issue.project_id) return <></>;
  const currentProjectId = issue.project_id;
  const currentIssueId = issue.id;

  const isPeekModeActive = Boolean(peekIssue);

  return (
    <>
      <div className="space-y-4 rounded-lg">
        {issue.parent_id && (
          <IssueParentDetail
            workspaceSlug={workspaceSlug}
            projectId={projectId}
            issueId={issueId}
            issue={issue}
            issueOperations={issueOperations}
          />
        )}

        <div className="mb-2.5 flex items-center justify-between gap-4">
          <IssueTypeSwitcher issueId={issueId} disabled={isArchived || !isEditable} />
          <div className="flex items-center gap-3">
            <NameDescriptionUpdateStatus isSubmitting={isSubmitting} />
          </div>
        </div>

        <IssueTitleInput
          key={issue.id}
          onSubmit={async (title) => {
            const response = await issueOperations.update(workspaceSlug, currentProjectId, currentIssueId, {
              name: title,
            });
            return response.name;
          }}
          setIsSubmitting={setTitleStatus}
          disabled={isArchived || !isEditable}
          value={issue.name}
          containerClassName="-ml-3"
        />

        <DescriptionInput
          issueSequenceId={issue.sequence_id}
          containerClassName="-ml-6 border-none p-0! pl-6!"
          disabled={isArchived || !isEditable}
          editorRef={editorRef}
          entityId={issue.id}
          fileAssetType={EFileAssetType.ISSUE_DESCRIPTION}
          initialValue={issue.description_html}
          key={issue.id}
          onSubmit={async (html, isMigrationUpdate) => {
            const response = await issueOperations.update(workspaceSlug, currentProjectId, currentIssueId, {
              description_html: html,
              ...(isMigrationUpdate ? { skip_activity: "true" } : {}),
            });
            return response.description_html;
          }}
          projectId={issue.project_id}
          setIsSubmitting={setDescriptionStatus}
          workspaceSlug={workspaceSlug}
        />

        <div className="flex items-center justify-between gap-2">
          {currentUser && (
            <IssueReaction
              className="flex-shrink-0"
              workspaceSlug={workspaceSlug}
              projectId={projectId}
              issueId={issueId}
              currentUser={currentUser}
              disabled={isArchived}
            />
          )}
          {isEditable && (
            <DescriptionVersionsRoot
              className="flex-shrink-0"
              entityInformation={{
                createdAt: issue.created_at ? new Date(issue.created_at) : new Date(),
                createdByDisplayName: getUserDetails(issue.created_by ?? "")?.display_name ?? "",
                id: issueId,
                isRestoreDisabled: !isEditable || isArchived,
              }}
              fetchHandlers={{
                listDescriptionVersions: (issueId) =>
                  workItemVersionService.listDescriptionVersions(workspaceSlug, projectId, issueId),
                retrieveDescriptionVersion: (issueId, versionId) =>
                  workItemVersionService.retrieveDescriptionVersion(workspaceSlug, projectId, issueId, versionId),
              }}
              handleRestore={(descriptionHTML) => editorRef.current?.setEditorValue(descriptionHTML, true)}
              projectId={projectId}
              workspaceSlug={workspaceSlug}
            />
          )}
        </div>
      </div>

      <IssueDetailWidgets
        workspaceSlug={workspaceSlug}
        projectId={projectId}
        issueId={issueId}
        disabled={!isEditable || isArchived}
        renderWidgetModals={!isPeekModeActive}
        issueServiceType={EIssueServiceType.ISSUES}
      />

      {windowSize[0] < 768 && (
        <PeekOverviewProperties
          workspaceSlug={workspaceSlug}
          projectId={projectId}
          issueId={issueId}
          issueOperations={issueOperations}
          disabled={!isEditable || isArchived}
        />
      )}

      <IssueActivity workspaceSlug={workspaceSlug} projectId={projectId} issueId={issueId} disabled={isArchived} />
    </>
  );
});
