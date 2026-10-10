/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useImperativeHandle, useRef, useState } from "react";
import { observer } from "mobx-react";
// plane imports
import type { EditorRefApi } from "@plane/editor";
import type { TNameDescriptionLoader } from "@plane/types";
import { EIssueServiceType } from "@plane/types";
import { DrawerContent } from "@plane/propel/drawer";
import type { TDrawerChangeEventDetails } from "@plane/propel/drawer";
import { cn } from "@plane/utils";
// hooks
import { useIssueDetail } from "@/hooks/store/use-issue-detail";
import { getPeekOutsidePressAction } from "./outside-press";
// local imports
import type { TIssueOperations } from "../issue-detail";
import { IssueActivity } from "../issue-detail/issue-activity";
import { IssueDetailWidgets } from "../issue-detail-widgets";
import { IssuePeekOverviewError } from "./error";
import type { TPeekModes } from "./header";
import { IssuePeekOverviewHeader } from "./header";
import { PeekOverviewIssueDetails } from "./issue-detail";
import { IssuePeekOverviewLoader } from "./loader";
import { PeekOverviewProperties } from "./properties";

interface IIssueView {
  workspaceSlug: string;
  projectId: string;
  issueId: string;
  isLoading?: boolean;
  isError?: boolean;
  is_archived: boolean;
  disabled?: boolean;
  embedIssue?: boolean;
  embedRemoveCurrentNotification?: () => void;
  issueOperations: TIssueOperations;
  /**
   * The always-mounted drawer root (in the peek root) forwards its close requests here, because
   * this view owns the state that decides whether a close is allowed (modals, editor menus).
   */
  closeRequestRef?: React.Ref<TPeekCloseRequest>;
}

export type TPeekCloseRequest = (open: boolean, details: TDrawerChangeEventDetails) => void;

export const IssueView = observer(function IssueView(props: IIssueView) {
  const {
    workspaceSlug,
    projectId,
    issueId,
    isLoading,
    isError,
    is_archived,
    disabled = false,
    embedIssue = false,
    embedRemoveCurrentNotification,
    issueOperations,
    closeRequestRef,
  } = props;
  // states
  const [peekMode, setPeekMode] = useState<TPeekModes>("side-peek");
  const [isSubmitting, setIsSubmitting] = useState<TNameDescriptionLoader>("saved");
  const [isDeleteIssueModalOpen, setIsDeleteIssueModalOpen] = useState(false);
  const [isArchiveIssueModalOpen, setIsArchiveIssueModalOpen] = useState(false);
  const [isDuplicateIssueModalOpen, setIsDuplicateIssueModalOpen] = useState(false);
  const [isEditIssueModalOpen, setIsEditIssueModalOpen] = useState(false);
  // ref
  const issuePeekOverviewRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<EditorRefApi>(null);
  // store hooks
  const {
    setPeekIssue,
    isAnyModalOpen,
    issue: { getIssueById },
  } = useIssueDetail();
  const { isAnyModalOpen: isAnyEpicModalOpen } = useIssueDetail(EIssueServiceType.EPICS);
  const issue = getIssueById(issueId);
  // remove peek id
  const removeRoutePeekId = () => {
    setPeekIssue(undefined);
    if (embedIssue && embedRemoveCurrentNotification) embedRemoveCurrentNotification();
  };

  const toggleDeleteIssueModal = (value: boolean) => setIsDeleteIssueModalOpen(value);
  const toggleArchiveIssueModal = (value: boolean) => setIsArchiveIssueModalOpen(value);
  const toggleDuplicateIssueModal = (value: boolean) => setIsDuplicateIssueModalOpen(value);
  const toggleEditIssueModal = (value: boolean) => setIsEditIssueModalOpen(value);

  const isAnyLocalModalOpen =
    isDeleteIssueModalOpen || isArchiveIssueModalOpen || isDuplicateIssueModalOpen || isEditIssueModalOpen;

  const isCloseBlocked = () =>
    isAnyModalOpen ||
    isAnyEpicModalOpen ||
    isAnyLocalModalOpen ||
    !!editorRef.current?.isAnyDropbarOpen() ||
    !!document.querySelector(".editor-image-full-screen-modal");

  // The drawer reports why it wants to close; the peek keeps its own product rules on top.
  const handleOpenChange: TPeekCloseRequest = (nextOpen, details) => {
    if (nextOpen) return;
    if (details.reason === "outside-press") {
      const action = getPeekOutsidePressAction(details.event?.target ?? null, issuePeekOverviewRef.current, issueId, [
        "main-sidebar",
      ]);
      if (action === "ignore" || isCloseBlocked()) return details.cancel();
      if (action === "delay") {
        details.cancel();
        setTimeout(removeRoutePeekId, 0);
        return;
      }
      return removeRoutePeekId();
    }
    if (details.reason === "escape-key") {
      if (isCloseBlocked() || document.activeElement?.tagName === "INPUT") return details.cancel();
      removeRoutePeekId();
      document.getElementById(`issue-${issueId}`)?.focus();
      return;
    }
    removeRoutePeekId();
  };

  useImperativeHandle(closeRequestRef, () => handleOpenChange);

  const handleRestore = async () => {
    if (!issueOperations.restore) return;
    await issueOperations.restore(workspaceSlug, projectId, issueId);
    removeRoutePeekId();
  };

  const drawerModeClassName = {
    "side-peek": "max-w-none md:w-1/2",
    modal: "h-5/6 w-5/6 max-w-none rounded-lg border",
    "full-screen": "m-4 h-[calc(100%-2rem)] max-w-none rounded-lg border",
  }[peekMode];

  const portalContainer = document.getElementById("full-screen-portal");

  const body = (
    <>
      {isError ? (
        <div className="relative h-screen w-full overflow-hidden">
          <IssuePeekOverviewError removeRoutePeekId={removeRoutePeekId} />
        </div>
      ) : (
        isLoading && <IssuePeekOverviewLoader removeRoutePeekId={removeRoutePeekId} />
      )}
      {!isLoading && !isError && issue && (
        <>
          {/* header */}
          <IssuePeekOverviewHeader
            peekMode={peekMode}
            setPeekMode={(value) => setPeekMode(value)}
            removeRoutePeekId={removeRoutePeekId}
            toggleDeleteIssueModal={toggleDeleteIssueModal}
            toggleArchiveIssueModal={toggleArchiveIssueModal}
            toggleDuplicateIssueModal={toggleDuplicateIssueModal}
            toggleEditIssueModal={toggleEditIssueModal}
            handleRestoreIssue={handleRestore}
            isArchived={is_archived}
            issueId={issueId}
            workspaceSlug={workspaceSlug}
            projectId={projectId}
            isSubmitting={isSubmitting}
            disabled={disabled}
            embedIssue={embedIssue}
          />
          {/* content */}
          <div className="vertical-scrollbar relative scrollbar-md h-full w-full overflow-hidden overflow-y-auto">
            {["side-peek", "modal"].includes(peekMode) ? (
              <div className="relative flex flex-col gap-3 space-y-3 px-8 py-5">
                <PeekOverviewIssueDetails
                  editorRef={editorRef}
                  workspaceSlug={workspaceSlug}
                  projectId={projectId}
                  issueId={issueId}
                  issueOperations={issueOperations}
                  disabled={disabled}
                  isArchived={is_archived}
                  isSubmitting={isSubmitting}
                  setIsSubmitting={(value) => setIsSubmitting(value)}
                />

                <div className="py-2">
                  <IssueDetailWidgets
                    workspaceSlug={workspaceSlug}
                    projectId={projectId}
                    issueId={issueId}
                    disabled={disabled || is_archived}
                    issueServiceType={EIssueServiceType.ISSUES}
                  />
                </div>

                <PeekOverviewProperties
                  workspaceSlug={workspaceSlug}
                  projectId={projectId}
                  issueId={issueId}
                  issueOperations={issueOperations}
                  disabled={disabled || is_archived}
                />

                <IssueActivity
                  workspaceSlug={workspaceSlug}
                  projectId={projectId}
                  issueId={issueId}
                  disabled={is_archived}
                />
              </div>
            ) : (
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
                      isArchived={is_archived}
                      isSubmitting={isSubmitting}
                      setIsSubmitting={(value) => setIsSubmitting(value)}
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

                    <IssueActivity
                      workspaceSlug={workspaceSlug}
                      projectId={projectId}
                      issueId={issueId}
                      disabled={is_archived}
                    />
                  </div>
                </div>
                <div
                  className={`vertical-scrollbar scrollbar-sm h-full !w-[400px] flex-shrink-0 overflow-hidden border-l border-subtle p-4 py-5 ${
                    is_archived ? "pointer-events-none" : ""
                  }`}
                >
                  <PeekOverviewProperties
                    workspaceSlug={workspaceSlug}
                    projectId={projectId}
                    issueId={issueId}
                    issueOperations={issueOperations}
                    disabled={disabled || is_archived}
                  />
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </>
  );

  if (embedIssue)
    return (
      <div className="w-full text-body-sm-regular">
        <div className="flex h-full w-full flex-col overflow-hidden">{body}</div>
      </div>
    );

  return (
    <DrawerContent
      ref={issuePeekOverviewRef}
      container={portalContainer}
      initialFocus={false}
      finalFocus={false}
      aria-label={issue?.name ?? "Work item"}
      viewportClassName={peekMode === "side-peek" ? undefined : "items-center justify-center"}
      className={cn("text-body-sm-regular", drawerModeClassName)}
    >
      {body}
    </DrawerContent>
  );
});
