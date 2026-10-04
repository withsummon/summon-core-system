/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useRef } from "react";
import { ModalCore, EModalWidth } from "@plane/ui";
import { Dialog } from "@plane/propel/dialog";
import { Button } from "@plane/propel/button";
import type { ProjectState } from "../root";

type Props = {
  state: ProjectState;
  pending: boolean;
  disabled: boolean;
  error: string;
  onClose: () => void;
  onSubmit: () => Promise<void>;
};
export function StateDelete({ state, pending, disabled, error, onClose, onSubmit }: Props) {
  const cancel = useRef<HTMLButtonElement | null>(null);
  return (
    <ModalCore isOpen handleClose={onClose} width={EModalWidth.XL} initialFocus={cancel}>
      <div className="space-y-2 p-5">
        <Dialog.Title className="text-16 font-medium">Delete State</Dialog.Title>
        <Dialog.Description className="text-13 text-secondary">
          Are you sure you want to delete state <span className="font-medium text-primary">{state.name}</span>? This
          action cannot be undone.
        </Dialog.Description>
        {error && (
          <p role="alert" className="text-13 text-danger-primary">
            {error}
          </p>
        )}
        {disabled && !pending && (
          <p className="text-13 text-secondary">Only project administrators can delete states.</p>
        )}
      </div>
      <div className="flex flex-wrap justify-end gap-2 border-t border-subtle px-5 py-4">
        <Button ref={cancel} variant="secondary" disabled={pending} onClick={onClose}>
          Cancel
        </Button>
        <Button variant="error-fill" disabled={disabled} loading={pending} onClick={() => void onSubmit()}>
          Delete
        </Button>
      </div>
    </ModalCore>
  );
}
