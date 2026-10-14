/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import { Clock, FileStack, MoreHorizontal } from "lucide-react";
// plane imports
import { useTranslation } from "@plane/i18n";
import { Button } from "@plane/propel/button";
import { getIconButtonStyling } from "@plane/propel/icon-button";
import {
  LinkIcon,
  CopyIcon,
  NewTabIcon,
  TrashIcon,
  CheckCircleFilledIcon,
  CloseCircleFilledIcon,
} from "@plane/propel/icons";
import { ControlLink, CustomMenu } from "@plane/ui";
// components
import { CreateUpdateIssueModal } from "@/components/issues/issue-modal/modal";
// store
import type { IInboxIssueStore } from "@/store/inbox/inbox-issue.store";
// local imports
import { DeclineIssueModal } from "../modals/decline-issue-modal";
import { DeleteInboxIssueModal } from "../modals/delete-issue-modal";
import { SelectDuplicateInboxIssueModal } from "../modals/select-duplicate";
import { InboxIssueSnoozeModal } from "../modals/snooze-issue-modal";

type TInboxIssueHeaderModalsProps = {
  inboxIssue: IInboxIssueStore;
  moveModalTitle: string;
  isDuplicateModalOpen: boolean;
  onCloseDuplicateModal: () => void;
  onDuplicate: (issueId: string) => Promise<void>;
  isAcceptModalOpen: boolean;
  onCloseAcceptModal: () => void;
  onAccept: () => Promise<void>;
  isDeclineModalOpen: boolean;
  onCloseDeclineModal: () => void;
  onDecline: () => Promise<void>;
  isDeleteModalOpen: boolean;
  onCloseDeleteModal: () => void;
  onDelete: () => Promise<void>;
  isSnoozeModalOpen: boolean;
  onCloseSnoozeModal: () => void;
  onSnooze: (date: Date) => Promise<void>;
};

/** Confirmation modals behind the intake work item actions. */
export const InboxIssueHeaderModals = observer(function InboxIssueHeaderModals(props: TInboxIssueHeaderModalsProps) {
  const {
    inboxIssue,
    moveModalTitle,
    isDuplicateModalOpen,
    onCloseDuplicateModal,
    onDuplicate,
    isAcceptModalOpen,
    onCloseAcceptModal,
    onAccept,
    isDeclineModalOpen,
    onCloseDeclineModal,
    onDecline,
    isDeleteModalOpen,
    onCloseDeleteModal,
    onDelete,
    isSnoozeModalOpen,
    onCloseSnoozeModal,
    onSnooze,
  } = props;
  const { t } = useTranslation();

  return (
    <>
      <SelectDuplicateInboxIssueModal
        isOpen={isDuplicateModalOpen}
        onClose={onCloseDuplicateModal}
        value={inboxIssue?.duplicate_to}
        onSubmit={onDuplicate}
      />
      <CreateUpdateIssueModal
        data={inboxIssue?.issue}
        isOpen={isAcceptModalOpen}
        onClose={onCloseAcceptModal}
        beforeFormSubmit={onAccept}
        withDraftIssueWrapper={false}
        fetchIssueDetails={false}
        showActionItemsOnUpdate
        modalTitle={moveModalTitle}
        primaryButtonText={{
          default: t("add_to_project"),
          loading: t("adding"),
        }}
      />
      <DeclineIssueModal
        data={inboxIssue?.issue || {}}
        isOpen={isDeclineModalOpen}
        onClose={onCloseDeclineModal}
        onSubmit={onDecline}
      />
      <DeleteInboxIssueModal
        data={inboxIssue?.issue}
        isOpen={isDeleteModalOpen}
        onClose={onCloseDeleteModal}
        onSubmit={onDelete}
      />
      <InboxIssueSnoozeModal
        isOpen={isSnoozeModalOpen}
        handleClose={onCloseSnoozeModal}
        value={inboxIssue?.snoozed_till}
        onConfirm={onSnooze}
      />
    </>
  );
});

type TInboxIssueDesktopActionsProps = {
  workItemLink: string;
  isAllowed: boolean;
  isProjectAdmin: boolean;
  canMarkAsAccepted: boolean;
  canMarkAsDeclined: boolean;
  canMarkAsDuplicate: boolean;
  canDelete: boolean;
  isAcceptedOrDeclined: boolean | undefined;
  isSnoozed: boolean;
  onAccept: () => void;
  onDecline: () => void;
  onSnoozeAction: () => Promise<void>;
  onMarkAsDuplicate: () => void;
  onDelete: () => void;
  onCopyLink: () => void;
  onOpen: () => void;
  handleActionWithPermission: (isAdmin: boolean, action: () => void, errorMessage: string) => void;
};

/** Accept / decline buttons plus the link or overflow actions for the desktop intake header. */
export function InboxIssueDesktopActions(props: TInboxIssueDesktopActionsProps) {
  const {
    workItemLink,
    isAllowed,
    isProjectAdmin,
    canMarkAsAccepted,
    canMarkAsDeclined,
    canMarkAsDuplicate,
    canDelete,
    isAcceptedOrDeclined,
    isSnoozed,
    onAccept,
    onDecline,
    onSnoozeAction,
    onMarkAsDuplicate,
    onDelete,
    onCopyLink,
    onOpen,
    handleActionWithPermission,
  } = props;
  const { t } = useTranslation();

  return (
    <div className="flex flex-wrap items-center gap-2">
      {canMarkAsAccepted && (
        <Button
          variant="secondary"
          size="lg"
          onClick={() =>
            handleActionWithPermission(isProjectAdmin, onAccept, t("inbox_issue.errors.accept_permission"))
          }
        >
          <CheckCircleFilledIcon className="size-4 shrink-0 text-success-secondary" />
          {t("inbox_issue.actions.accept")}
        </Button>
      )}

      {canMarkAsDeclined && (
        <Button
          variant="secondary"
          size="lg"
          onClick={() =>
            handleActionWithPermission(isProjectAdmin, onDecline, t("inbox_issue.errors.decline_permission"))
          }
        >
          <CloseCircleFilledIcon className="size-4 shrink-0 text-danger-secondary" />
          {t("inbox_issue.actions.decline")}
        </Button>
      )}

      {isAcceptedOrDeclined ? (
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="lg" prependIcon={<LinkIcon className="h-2.5 w-2.5" />} onClick={onCopyLink}>
            {t("inbox_issue.actions.copy")}
          </Button>
          <ControlLink href={workItemLink} onClick={onOpen} target="_self">
            <Button variant="secondary" size="lg" prependIcon={<NewTabIcon className="h-2.5 w-2.5" />}>
              {t("inbox_issue.actions.open")}
            </Button>
          </ControlLink>
        </div>
      ) : (
        <>
          {isAllowed && (
            <CustomMenu
              customButton={<MoreHorizontal className="size-4" />}
              customButtonClassName={getIconButtonStyling("secondary", "lg")}
              placement="bottom-start"
            >
              {canMarkAsAccepted && (
                <CustomMenu.MenuItem
                  onClick={() =>
                    handleActionWithPermission(
                      isProjectAdmin,
                      onSnoozeAction,
                      t("inbox_issue.errors.snooze_permission")
                    )
                  }
                >
                  <div className="flex items-center gap-2">
                    <Clock size={14} strokeWidth={2} />
                    {isSnoozed ? t("inbox_issue.actions.unsnooze") : t("inbox_issue.actions.snooze")}
                  </div>
                </CustomMenu.MenuItem>
              )}
              {canMarkAsDuplicate && (
                <CustomMenu.MenuItem
                  onClick={() =>
                    handleActionWithPermission(
                      isProjectAdmin,
                      onMarkAsDuplicate,
                      "Only project admins can mark work item as duplicate"
                    )
                  }
                >
                  <div className="flex items-center gap-2">
                    <FileStack size={14} strokeWidth={2} />
                    {t("inbox_issue.actions.mark_as_duplicate")}
                  </div>
                </CustomMenu.MenuItem>
              )}
              <CustomMenu.MenuItem onClick={onCopyLink}>
                <div className="flex items-center gap-2">
                  <CopyIcon width={14} height={14} strokeWidth={2} />
                  {t("inbox_issue.actions.copy")}
                </div>
              </CustomMenu.MenuItem>
              {canDelete && (
                <CustomMenu.MenuItem onClick={onDelete}>
                  <div className="flex items-center gap-2">
                    <TrashIcon width={14} height={14} strokeWidth={2} />
                    {t("inbox_issue.actions.delete")}
                  </div>
                </CustomMenu.MenuItem>
              )}
            </CustomMenu>
          )}
        </>
      )}
    </div>
  );
}
