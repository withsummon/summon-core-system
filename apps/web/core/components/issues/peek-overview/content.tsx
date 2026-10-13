/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { Dispatch, RefObject, SetStateAction } from "react";
import { observer } from "mobx-react";
// plane imports
import type { EditorRefApi } from "@plane/editor";
import type { TNameDescriptionLoader } from "@plane/types";
import { EIssueServiceType } from "@plane/types";
import { cn } from "@plane/utils";
// local imports
import type { TIssueOperations } from "../issue-detail";
import { IssueActivity } from "../issue-detail/issue-activity";
import { IssueDetailWidgets } from "../issue-detail-widgets";
import type { TPeekModes } from "./header";
import { PeekOverviewIssueDetails } from "./issue-detail";
import { PeekOverviewProperties } from "./properties";

type Props = {
  peekMode: TPeekModes;
  editorRef: RefObject<EditorRefApi>;
  workspaceSlug: string;
  projectId: string;
  issueId: string;
  issueOperations: TIssueOperations;
  disabled: boolean;
  isArchived: boolean;
  isSubmitting: TNameDescriptionLoader;
  setIsSubmitting: Dispatch<SetStateAction<TNameDescriptionLoader>>;
};

/** Peek body: a single column in side-peek and modal modes, details plus a properties sidebar in full screen. */
export const PeekOverviewContent = observer(function PeekOverviewContent(props: Props) {
  const {
    peekMode,
    editorRef,
    workspaceSlug,
    projectId,
    issueId,
    issueOperations,
    disabled,
    isArchived,
    isSubmitting,
    setIsSubmitting,
  } = props;
  const isPropertiesDisabled = disabled || isArchived;

  if (peekMode !== "full-screen")
    return (
      <div className="relative flex flex-col gap-3 space-y-3 px-8 py-5">
        <PeekOverviewIssueDetails
          editorRef={editorRef}
          workspaceSlug={workspaceSlug}
          projectId={projectId}
          issueId={issueId}
          issueOperations={issueOperations}
          disabled={disabled}
          isArchived={isArchived}
          isSubmitting={isSubmitting}
          setIsSubmitting={setIsSubmitting}
        />

        <div className="py-2">
          <IssueDetailWidgets
            workspaceSlug={workspaceSlug}
            projectId={projectId}
            issueId={issueId}
            disabled={isPropertiesDisabled}
            issueServiceType={EIssueServiceType.ISSUES}
          />
        </div>

        <PeekOverviewProperties
          workspaceSlug={workspaceSlug}
          projectId={projectId}
          issueId={issueId}
          issueOperations={issueOperations}
          disabled={isPropertiesDisabled}
        />

        <IssueActivity workspaceSlug={workspaceSlug} projectId={projectId} issueId={issueId} disabled={isArchived} />
      </div>
    );

  return (
    <div className="vertical-scrollbar flex h-full w-full overflow-auto">
      <div className="relative h-full w-full space-y-6 overflow-auto p-4 py-5">
        <div className="space-y-3">
          <PeekOverviewIssueDetails
            editorRef={editorRef}
            workspaceSlug={workspaceSlug}
            projectId={projectId}
            issueId={issueId}
            issueOperations={issueOperations}
            disabled={disabled}
            isArchived={isArchived}
            isSubmitting={isSubmitting}
            setIsSubmitting={setIsSubmitting}
          />

          <div className="py-2">
            <IssueDetailWidgets
              workspaceSlug={workspaceSlug}
              projectId={projectId}
              issueId={issueId}
              disabled={disabled}
              issueServiceType={EIssueServiceType.ISSUES}
            />
          </div>

          <IssueActivity workspaceSlug={workspaceSlug} projectId={projectId} issueId={issueId} disabled={isArchived} />
        </div>
      </div>
      <div
        className={cn(
          "vertical-scrollbar scrollbar-sm h-full !w-[400px] flex-shrink-0 overflow-hidden border-l border-subtle p-4 py-5",
          { "pointer-events-none": isArchived }
        )}
      >
        <PeekOverviewProperties
          workspaceSlug={workspaceSlug}
          projectId={projectId}
          issueId={issueId}
          issueOperations={issueOperations}
          disabled={isPropertiesDisabled}
        />
      </div>
    </div>
  );
});
