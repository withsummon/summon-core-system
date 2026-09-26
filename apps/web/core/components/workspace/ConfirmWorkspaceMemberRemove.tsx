/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import React, { useState } from "react";
import { observer } from "mobx-react";
import { AlertTriangle } from "lucide-react";
import { Dialog } from "@plane/propel/dialog";
import { Button } from "@plane/propel/button";
import { useUser } from "@/hooks/store/user";
import type { Props } from "./confirm-workspace-member-remove";

export const ConfirmWorkspaceMemberRemove = observer(function ConfirmWorkspaceMemberRemove(props: Props) {
  const { isOpen, onClose, onSubmit, userDetails } = props;
  // states
  const [isRemoving, setIsRemoving] = useState(false);
  // store hooks
  const { data: currentUser } = useUser();

  const handleClose = () => {
    onClose();
    setIsRemoving(false);
  };

  const handleDeletion = async () => {
    setIsRemoving(true);

    await onSubmit();

    handleClose();
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) handleClose();
      }}
    >
      <Dialog.Panel className="sm:max-w-[40rem]">
        <div className="px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
          <div className="sm:flex sm:items-start">
            <div className="mx-auto flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-danger-subtle sm:mx-0 sm:h-10 sm:w-10">
              <AlertTriangle className="h-6 w-6 text-danger-primary" aria-hidden="true" />
            </div>
            <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
              <Dialog.Title className="text-16 leading-6 font-medium text-primary">
                {currentUser?.id === userDetails.id ? "Leave workspace?" : `Remove ${userDetails?.display_name}?`}
              </Dialog.Title>
              <div className="mt-2">
                {currentUser?.id === userDetails.id ? (
                  <p className="text-13 text-secondary">
                    Are you sure you want to leave the workspace? You will no longer have access to this workspace. This
                    action cannot be undone.
                  </p>
                ) : (
                  <p className="text-13 text-secondary">
                    Are you sure you want to remove member-{" "}
                    <span className="font-bold">{userDetails?.display_name}</span>? They will no longer have access to
                    this workspace. This action cannot be undone.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 p-4 sm:px-6">
          <Button variant="secondary" onClick={handleClose}>
            Cancel
          </Button>
          <Button variant="error-fill" onClick={handleDeletion} loading={isRemoving}>
            {currentUser?.id === userDetails.id
              ? isRemoving
                ? "Leaving"
                : "Leave"
              : isRemoving
                ? "Removing"
                : "Remove"}
          </Button>
        </div>
      </Dialog.Panel>
    </Dialog>
  );
});
