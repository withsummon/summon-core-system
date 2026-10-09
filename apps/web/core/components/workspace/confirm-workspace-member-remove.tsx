/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { useTranslation } from "@plane/i18n";
import { Button } from "@plane/propel/button";
import { Dialog } from "@plane/propel/dialog";
import { mutationMessage } from "@/components/convex-core/commercial/forms";

type Props = {
  onClose: () => void;
  onSubmit: () => Promise<void>;
  kind: "leave" | "member" | "invitation";
  displayName: string | null;
};

export function ConfirmWorkspaceMemberRemove({ onClose, onSubmit, kind, displayName }: Props) {
  const { t } = useTranslation();
  const isSelf = kind === "leave";
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const close = () => {
    if (!pending) onClose();
  };
  const submit = async () => {
    setPending(true);
    setError("");
    try {
      await onSubmit();
      onClose();
    } catch (failure) {
      setError(mutationMessage(failure));
    } finally {
      setPending(false);
    }
  };
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) close();
      }}
    >
      <Dialog.Panel className="sm:max-w-[40rem]">
        <div className="px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
          <div className="sm:flex sm:items-start">
            <div className="mx-auto flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-danger-subtle sm:mx-0 sm:h-10 sm:w-10">
              <AlertTriangle className="h-6 w-6 text-danger-primary" aria-hidden="true" />
            </div>
            <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
              <Dialog.Title className="text-h5-medium leading-6 text-primary">
                {isSelf
                  ? "Leave workspace?"
                  : kind === "invitation"
                    ? `Remove invitation for ${displayName}?`
                    : displayName
                      ? `Remove ${displayName}?`
                      : "Remove member?"}
              </Dialog.Title>
              <p className="mt-2 text-body-xs-regular text-secondary">
                {isSelf
                  ? "You will lose access to this workspace and its projects. An administrator can invite you again."
                  : kind === "invitation"
                    ? "This invitation will stop working. You can create a new invitation if needed."
                    : "They will lose access to this workspace and its projects. An administrator can invite them again."}
              </p>
              {error && (
                <p role="alert" className="mt-2 text-body-xs-regular text-danger-primary">
                  {error}
                </p>
              )}
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 p-4 sm:px-6">
          <Button variant="secondary" size="lg" disabled={pending} onClick={close}>
            {t("cancel")}
          </Button>
          <Button variant="error-fill" size="lg" onClick={() => void submit()} loading={pending}>
            {t(isSelf ? (pending ? "leaving" : "leave") : pending ? "removing" : "remove")}
          </Button>
        </div>
      </Dialog.Panel>
    </Dialog>
  );
}
