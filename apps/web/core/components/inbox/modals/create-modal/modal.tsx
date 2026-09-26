/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
// plane imports
import { EModalPosition, EModalWidth, ModalCore } from "@plane/ui";
// hooks
// local imports
import { InboxIssueCreateRoot } from "./create-root";

type TInboxIssueCreateModalRoot = {
  workspaceSlug: string;
  projectId: string;
  modalState: boolean;
  handleModalClose: () => void;
};

export function InboxIssueCreateModalRoot(props: TInboxIssueCreateModalRoot) {
  const { workspaceSlug, projectId, modalState, handleModalClose } = props;
  // states
  const [isDuplicateModalOpen, setIsDuplicateModalOpen] = useState(false);
  // handlers
  const handleDuplicateIssueModal = (value: boolean) => setIsDuplicateModalOpen(value);

  const handleClose = () => {
    handleModalClose();
    setIsDuplicateModalOpen(false);
  };

  return (
    <ModalCore
      isOpen={modalState}
      handleClose={handleClose}
      position={EModalPosition.TOP}
      width={isDuplicateModalOpen ? EModalWidth.VIXL : EModalWidth.XXXXL}
      className="rounded-lg !bg-transparent shadow-none"
    >
      <InboxIssueCreateRoot
        workspaceSlug={workspaceSlug}
        projectId={projectId}
        handleModalClose={handleModalClose}
        isDuplicateModalOpen={isDuplicateModalOpen}
        handleDuplicateIssueModal={handleDuplicateIssueModal}
      />
    </ModalCore>
  );
}
