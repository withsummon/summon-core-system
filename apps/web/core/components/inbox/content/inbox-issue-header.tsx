/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import { observer } from "mobx-react";
import { MoveRight } from "lucide-react";
// plane imports
import { useTranslation } from "@plane/i18n";
import { IconButton } from "@plane/propel/icon-button";
import { ChevronDownIcon, ChevronUpIcon } from "@plane/propel/icons";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import type { TNameDescriptionLoader } from "@plane/types";
import { EInboxIssueStatus } from "@plane/types";
import { Row } from "@plane/ui";
import { copyUrlToClipboard, findHowManyDaysLeft, generateWorkItemLink } from "@plane/utils";
// components
import { NameDescriptionUpdateStatus } from "@/components/issues/issue-update-status";
// hooks
import { useProject } from "@/hooks/store/use-project";
import { useProjectInbox } from "@/hooks/store/use-project-inbox";
import { useAppRouter } from "@/hooks/use-app-router";
// store
import type { IInboxIssueStore } from "@/store/inbox/inbox-issue.store";
// local imports
import { InboxIssueStatus } from "../inbox-issue-status";
import { InboxIssueDesktopActions, InboxIssueHeaderModals } from "./inbox-issue-header-actions";
import { InboxIssueActionsMobileHeader } from "./inbox-issue-mobile-header";
import { useInboxIssueNavigation } from "./use-inbox-issue-navigation";
import { useInboxIssuePermissions } from "./use-inbox-issue-permissions";

type TInboxIssueActionsHeader = {
  workspaceSlug: string;
  projectId: string;
  inboxIssue: IInboxIssueStore | undefined;
  isSubmitting: TNameDescriptionLoader;
  isMobileSidebar: boolean;
  setIsMobileSidebar: (value: boolean) => void;
  isNotificationEmbed: boolean;
  embedRemoveCurrentNotification?: () => void;
};

export const InboxIssueActionsHeader = observer(function InboxIssueActionsHeader(props: TInboxIssueActionsHeader) {
  const {
    workspaceSlug,
    projectId,
    inboxIssue,
    isSubmitting,
    isMobileSidebar,
    setIsMobileSidebar,
    isNotificationEmbed = false,
    embedRemoveCurrentNotification,
  } = props;
  // states
  const [isSnoozeDateModalOpen, setIsSnoozeDateModalOpen] = useState(false);
  const [selectDuplicateIssue, setSelectDuplicateIssue] = useState(false);
  const [acceptIssueModal, setAcceptIssueModal] = useState(false);
  const [declineIssueModal, setDeclineIssueModal] = useState(false);
  const [deleteIssueModal, setDeleteIssueModal] = useState(false);
  // store
  const { deleteInboxIssue } = useProjectInbox();
  const { getPartialProjectById } = useProject();
  const currentProjectDetails = getPartialProjectById(projectId);
  const { t } = useTranslation();

  const router = useAppRouter();
  const { getProjectById } = useProject();

  const issue = inboxIssue?.issue;
  // derived values
  const {
    isAllowed,
    isProjectAdmin,
    canMarkAsDuplicate,
    canMarkAsAccepted,
    canMarkAsDeclined,
    canDelete,
    isAcceptedOrDeclined,
  } = useInboxIssuePermissions(workspaceSlug, projectId, inboxIssue);
  // days left for snooze
  const numberOfDaysLeft = findHowManyDaysLeft(inboxIssue?.snoozed_till);
  const isSnoozed = !!inboxIssue?.snoozed_till && !!numberOfDaysLeft && numberOfDaysLeft > 0;

  const currentInboxIssueId = inboxIssue?.issue?.id;
  const { getAdjacentIssueId, redirectToIssue, handleInboxIssueNavigation } = useInboxIssueNavigation({
    workspaceSlug,
    projectId,
    currentInboxIssueId,
    isNotificationEmbed,
    isSubmitting,
  });

  const handleInboxIssueAccept = async () => {
    const nextOrPreviousIssueId = getAdjacentIssueId();
    await inboxIssue?.updateInboxIssueStatus(EInboxIssueStatus.ACCEPTED);
    setAcceptIssueModal(false);
    redirectToIssue(nextOrPreviousIssueId);
  };

  const handleInboxIssueDecline = async () => {
    const nextOrPreviousIssueId = getAdjacentIssueId();
    await inboxIssue?.updateInboxIssueStatus(EInboxIssueStatus.DECLINED);
    setDeclineIssueModal(false);
    redirectToIssue(nextOrPreviousIssueId);
  };

  const handleInboxIssueSnooze = async (date: Date) => {
    const nextOrPreviousIssueId = getAdjacentIssueId();
    await inboxIssue?.updateInboxIssueSnoozeTill(date);
    setIsSnoozeDateModalOpen(false);
    redirectToIssue(nextOrPreviousIssueId);
  };

  const handleInboxIssueDuplicate = async (issueId: string) => {
    await inboxIssue?.updateInboxIssueDuplicateTo(issueId);
  };

  const handleInboxIssueDelete = async () => {
    if (!inboxIssue || !currentInboxIssueId) return;
    await deleteInboxIssue(workspaceSlug, projectId, currentInboxIssueId);
    if (!isNotificationEmbed) router.push(`/${workspaceSlug}/projects/${projectId}/intake`);
  };

  const handleIssueSnoozeAction = async () => {
    if (isSnoozed) {
      const nextOrPreviousIssueId = getAdjacentIssueId();
      await inboxIssue?.updateInboxIssueSnoozeTill(undefined);
      redirectToIssue(nextOrPreviousIssueId);
    } else {
      setIsSnoozeDateModalOpen(true);
    }
  };

  const handleCopyIssueLink = (path: string) =>
    copyUrlToClipboard(path).then(() =>
      setToast({
        type: TOAST_TYPE.SUCCESS,
        title: t("common.link_copied"),
        message: t("common.copied_to_clipboard"),
      })
    );

  const handleActionWithPermission = (isAdmin: boolean, action: () => void, errorMessage: string) => {
    if (isAdmin) action();
    else {
      setToast({
        type: TOAST_TYPE.ERROR,
        title: "Permission denied",
        message: errorMessage,
      });
    }
  };

  if (!inboxIssue) return null;

  const workItemLink = generateWorkItemLink({
    workspaceSlug: workspaceSlug?.toString(),
    projectId: issue?.project_id,
    issueId: currentInboxIssueId,
    projectIdentifier: currentProjectDetails?.identifier,
    sequenceId: issue?.sequence_id,
  });

  return (
    <>
      <InboxIssueHeaderModals
        inboxIssue={inboxIssue}
        moveModalTitle={t("inbox_issue.actions.move", {
          value: `${currentProjectDetails?.identifier}-${issue?.sequence_id}`,
        })}
        isDuplicateModalOpen={selectDuplicateIssue}
        onCloseDuplicateModal={() => setSelectDuplicateIssue(false)}
        onDuplicate={handleInboxIssueDuplicate}
        isAcceptModalOpen={acceptIssueModal}
        onCloseAcceptModal={() => setAcceptIssueModal(false)}
        onAccept={handleInboxIssueAccept}
        isDeclineModalOpen={declineIssueModal}
        onCloseDeclineModal={() => setDeclineIssueModal(false)}
        onDecline={handleInboxIssueDecline}
        isDeleteModalOpen={deleteIssueModal}
        onCloseDeleteModal={() => setDeleteIssueModal(false)}
        onDelete={handleInboxIssueDelete}
        isSnoozeModalOpen={isSnoozeDateModalOpen}
        onCloseSnoozeModal={() => setIsSnoozeDateModalOpen(false)}
        onSnooze={handleInboxIssueSnooze}
      />

      <Row className="relative z-15 hidden h-full w-full items-center justify-between gap-2 border-b border-subtle bg-surface-1 lg:flex">
        <div className="flex items-center gap-4">
          {isNotificationEmbed && (
            <button type="button" aria-label="Close" onClick={embedRemoveCurrentNotification}>
              <MoveRight className="h-4 w-4 text-tertiary hover:text-secondary" />
            </button>
          )}
          {issue?.project_id && issue.sequence_id && (
            <h3 className="flex-shrink-0 text-14 font-medium text-tertiary">
              {getProjectById(issue.project_id)?.identifier}-{issue.sequence_id}
            </h3>
          )}
          <InboxIssueStatus inboxIssue={inboxIssue} iconSize={12} />
          <div className="flex w-full items-center justify-end">
            <NameDescriptionUpdateStatus isSubmitting={isSubmitting} />
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!isNotificationEmbed && (
            <div className="flex items-center gap-x-2">
              <IconButton
                variant="secondary"
                size="lg"
                icon={ChevronUpIcon}
                aria-label="Previous work item"
                onClick={() => handleInboxIssueNavigation("prev")}
              />
              <IconButton
                variant="secondary"
                size="lg"
                icon={ChevronDownIcon}
                aria-label="Next work item"
                onClick={() => handleInboxIssueNavigation("next")}
              />
            </div>
          )}

          <InboxIssueDesktopActions
            workItemLink={workItemLink}
            isAllowed={isAllowed}
            isProjectAdmin={isProjectAdmin}
            canMarkAsAccepted={canMarkAsAccepted}
            canMarkAsDeclined={canMarkAsDeclined}
            canMarkAsDuplicate={canMarkAsDuplicate}
            canDelete={canDelete}
            isAcceptedOrDeclined={isAcceptedOrDeclined}
            isSnoozed={isSnoozed}
            onAccept={() => setAcceptIssueModal(true)}
            onDecline={() => setDeclineIssueModal(true)}
            onSnoozeAction={handleIssueSnoozeAction}
            onMarkAsDuplicate={() => setSelectDuplicateIssue(true)}
            onDelete={() => setDeleteIssueModal(true)}
            onCopyLink={() => handleCopyIssueLink(workItemLink)}
            onOpen={() => router.push(workItemLink)}
            handleActionWithPermission={handleActionWithPermission}
          />
        </div>
      </Row>

      <div className="lg:hidden">
        <InboxIssueActionsMobileHeader
          inboxIssue={inboxIssue}
          isSubmitting={isSubmitting}
          handleCopyIssueLink={() => handleCopyIssueLink(workItemLink)}
          setAcceptIssueModal={setAcceptIssueModal}
          setDeclineIssueModal={setDeclineIssueModal}
          handleIssueSnoozeAction={handleIssueSnoozeAction}
          setSelectDuplicateIssue={setSelectDuplicateIssue}
          setDeleteIssueModal={setDeleteIssueModal}
          canMarkAsAccepted={canMarkAsAccepted}
          canMarkAsDeclined={canMarkAsDeclined}
          canMarkAsDuplicate={canMarkAsDuplicate}
          canDelete={canDelete}
          isAcceptedOrDeclined={isAcceptedOrDeclined}
          handleInboxIssueNavigation={handleInboxIssueNavigation}
          workspaceSlug={workspaceSlug}
          isMobileSidebar={isMobileSidebar}
          setIsMobileSidebar={setIsMobileSidebar}
          isNotificationEmbed={isNotificationEmbed}
          embedRemoveCurrentNotification={embedRemoveCurrentNotification}
          isProjectAdmin={isProjectAdmin}
          handleActionWithPermission={handleActionWithPermission}
        />
      </div>
    </>
  );
});
