/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import type { EditorRefApi } from "@plane/editor";
import type { TIssue } from "@plane/types";
import { DescriptionVersionsRoot } from "@/components/core/description-versions";
import { useMember } from "@/hooks/store/use-member";
import { WorkItemVersionService } from "@/services/issue";

const workItemVersionService = new WorkItemVersionService();

type Props = {
  workspaceSlug: string;
  projectId: string;
  issue: TIssue;
  editorRef: React.RefObject<EditorRefApi | null>;
  isRestoreDisabled: boolean;
};

export const WorkItemDescriptionVersions = observer(function WorkItemDescriptionVersions(props: Props) {
  const { workspaceSlug, projectId, issue, editorRef, isRestoreDisabled } = props;
  const { getUserDetails } = useMember();

  const createdAt = issue.created_at ? new Date(issue.created_at) : new Date();

  return (
    <DescriptionVersionsRoot
      className="flex-shrink-0"
      entityInformation={{
        createdAt,
        createdByDisplayName: getUserDetails(issue.created_by ?? "")?.display_name ?? "",
        id: issue.id,
        isRestoreDisabled,
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
  );
});
