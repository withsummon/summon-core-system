// oxlint-disable no-shadow
/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useEffect, useState } from "react";
import { observer } from "mobx-react";
// plane imports
import type { EditorRefApi } from "@plane/editor";
import { EFileAssetType } from "@plane/types";
import type { TNameDescriptionLoader } from "@plane/types";
// components
import { DescriptionVersionsRoot } from "@/components/core/description-versions";
import { DescriptionInput } from "@/components/editor/rich-text/description-input";
// hooks
import { useIssueDetail } from "@/hooks/store/use-issue-detail";
import { useMember } from "@/hooks/store/use-member";
import { useUser } from "@/hooks/store/user";
import useReloadConfirmations from "@/hooks/use-reload-confirmation";
// plane web components
import { IssueTypeSwitcher } from "@/components/issues/issue-type-switcher";
// plane web hooks
// services
import { WorkItemVersionService } from "@/services/issue";
// local components
import type { TIssueOperations } from "../issue-detail";
import { IssueParentDetail } from "../issue-detail/parent";
import { IssueReaction } from "../issue-detail/reactions";
import { IssueTitleInput } from "../title-input";
import { nameDescriptionStatus } from "../issue-update-status";
// services init
const workItemVersionService = new WorkItemVersionService();

type Props = {
  editorRef: React.RefObject<EditorRefApi>;
  workspaceSlug: string;
  projectId: string;
  issueId: string;
  issueOperations: TIssueOperations;
  disabled: boolean;
  isArchived: boolean;
  setIsSubmitting: (value: TNameDescriptionLoader) => void;
};

export const PeekOverviewIssueDetails = observer(function PeekOverviewIssueDetails(props: Props) {
  const { editorRef, workspaceSlug, issueId, issueOperations, disabled, isArchived, setIsSubmitting } = props;
  const [titleStatus, setTitleStatus] = useState<TNameDescriptionLoader>("saved");
  const [descriptionStatus, setDescriptionStatus] = useState<TNameDescriptionLoader>("saved");
  const isSubmitting = nameDescriptionStatus(titleStatus, descriptionStatus);
  useEffect(() => setIsSubmitting(isSubmitting), [isSubmitting, setIsSubmitting]);
  // store hooks
  const { data: currentUser } = useUser();
  const {
    issue: { getIssueById },
  } = useIssueDetail();

  const { getUserDetails } = useMember();
  // reload confirmation
  useReloadConfirmations(isSubmitting === "submitting" || isSubmitting === "failed");

  useEffect(() => {
    if (isSubmitting !== "submitted") return;
    const timer = setTimeout(() => {
      setTitleStatus("saved");
      setDescriptionStatus("saved");
    }, 2000);
    return () => clearTimeout(timer);
  }, [isSubmitting]);

  // derived values
  const issue = issueId ? getIssueById(issueId) : undefined;

  if (!issue || !issue.project_id) return <></>;
  const currentProjectId = issue.project_id;
  const currentIssueId = issue.id;

  return (
    <div className="space-y-2">
      {issue.parent_id && (
        <IssueParentDetail
          workspaceSlug={workspaceSlug}
          projectId={issue.project_id}
          issueId={issueId}
          issue={issue}
          issueOperations={issueOperations}
        />
      )}
      <div className="flex items-center justify-between gap-2">
        <IssueTypeSwitcher issueId={issueId} disabled={isArchived || disabled} />
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
        disabled={disabled || isArchived}
        value={issue.name}
        containerClassName="-ml-3"
      />

      <DescriptionInput
        issueSequenceId={issue.sequence_id}
        containerClassName="-ml-3 border-none"
        disabled={disabled || isArchived}
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
        setIsSubmitting={setDescriptionStatus}
        projectId={issue.project_id}
        workspaceSlug={workspaceSlug}
      />

      <div className="flex items-center justify-between gap-2">
        {currentUser && (
          <IssueReaction
            workspaceSlug={workspaceSlug}
            projectId={issue.project_id}
            issueId={issueId}
            currentUser={currentUser}
            disabled={isArchived}
          />
        )}
        {!disabled && (
          <DescriptionVersionsRoot
            className="flex-shrink-0"
            entityInformation={{
              createdAt: issue.created_at ? new Date(issue.created_at) : new Date(),
              createdByDisplayName: getUserDetails(issue.created_by ?? "")?.display_name ?? "",
              id: issueId,
              isRestoreDisabled: disabled || isArchived,
            }}
            fetchHandlers={{
              listDescriptionVersions: (issueId) =>
                workItemVersionService.listDescriptionVersions(
                  workspaceSlug,
                  issue.project_id?.toString() ?? "",
                  issueId
                ),
              retrieveDescriptionVersion: (issueId, versionId) =>
                workItemVersionService.retrieveDescriptionVersion(
                  workspaceSlug,
                  issue.project_id?.toString() ?? "",
                  issueId,
                  versionId
                ),
            }}
            handleRestore={(descriptionHTML) => editorRef.current?.setEditorValue(descriptionHTML, true)}
            projectId={issue.project_id}
            workspaceSlug={workspaceSlug}
          />
        )}
      </div>
    </div>
  );
});
