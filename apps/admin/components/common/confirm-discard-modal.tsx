/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import Link from "next/link";

import { Dialog } from "@plane/propel/dialog";
// ui
import { Button, getButtonStyling } from "@plane/propel/button";

type Props = {
  isOpen: boolean;
  handleClose: () => void;
  onDiscardHref: string;
};

export function ConfirmDiscardModal(props: Props) {
  const { isOpen, handleClose, onDiscardHref } = props;

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) handleClose();
      }}
    >
      <Dialog.Panel className="overflow-hidden rounded-lg bg-surface-1 text-left shadow-raised-200 transition-all sm:w-[30rem]">
        <div className="px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
          <div className="sm:flex sm:items-start">
            <div className="mt-3 text-center sm:mt-0 sm:text-left">
              <Dialog.Title className="text-16 leading-6 font-medium text-tertiary">
                You have unsaved changes
              </Dialog.Title>
              <div className="mt-2">
                <p className="text-13 text-placeholder">
                  Changes you made will be lost if you go back. Do you wish to go back?
                </p>
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 p-4 sm:px-6">
          <Button variant="secondary" size="lg" onClick={handleClose}>
            Keep editing
          </Button>
          <Link href={onDiscardHref} className={getButtonStyling("primary", "base")}>
            Go back
          </Link>
        </div>
      </Dialog.Panel>
    </Dialog>
  );
}
