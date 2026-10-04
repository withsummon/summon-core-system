/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useRef, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@plane/propel/button";
import { Dialog } from "@plane/propel/dialog";
import { EModalPosition, EModalWidth, ModalCore } from "@plane/ui";
import { mutationMessage } from "@/components/convex-core/commercial/forms";
import useReloadConfirmations from "@/hooks/use-reload-confirmation";
import type { ProjectMember } from "./settings/member-columns";

export function ConfirmProjectMemberRemove({
  member,
  projectName,
  onSubmit,
  onClose,
  onSuccess,
}: {
  member: ProjectMember;
  projectName: string;
  onSubmit: () => Promise<void>;
  onClose: () => void;
  onSuccess?: () => void;
}) {
  const cancel = useRef<HTMLButtonElement>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const release = useReloadConfirmations(
    pending,
    "The project membership command is still running.",
    undefined,
    pending
  );
  const close = () => {
    if (!pending) onClose();
  };
  const submit = async () => {
    if (pending) return;
    setPending(true);
    setError("");
    try {
      await onSubmit();
      release((allowDefaultNavigation) => {
        if (allowDefaultNavigation) onSuccess?.();
      });
      onClose();
    } catch (failure) {
      setError(mutationMessage(failure));
    } finally {
      setPending(false);
    }
  };
  return (
    <ModalCore
      isOpen
      handleClose={close}
      position={EModalPosition.CENTER}
      width={EModalWidth.XXL}
      initialFocus={cancel}
    >
      <div className="bg-surface-1 px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
        <div className="sm:flex sm:items-start">
          <div className="mx-auto flex size-12 shrink-0 items-center justify-center rounded-full bg-danger-subtle sm:mx-0 sm:size-10">
            <AlertTriangle className="size-6 text-danger-primary" aria-hidden="true" />
          </div>
          <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
            <Dialog.Title className="text-16 leading-6 font-medium text-primary">
              {member.canLeave ? "Leave project?" : `Remove ${member.displayName ?? member.fullName}?`}
            </Dialog.Title>
            <Dialog.Description className="mt-2 text-13 text-secondary">
              {member.canLeave
                ? `You will lose access to ${projectName}. An administrator can add you again, or you can rejoin if the project is public.`
                : "They will lose access to this project. An administrator can add them again."}
            </Dialog.Description>
            {error && (
              <p role="alert" className="mt-2 text-13 text-danger-primary">
                {error}
              </p>
            )}
          </div>
        </div>
      </div>
      <div className="flex justify-end gap-2 p-4 sm:px-6">
        <Button ref={cancel} variant="secondary" size="lg" disabled={pending} onClick={close}>
          Cancel
        </Button>
        <Button variant="error-fill" size="lg" onClick={() => void submit()} loading={pending}>
          {member.canLeave ? (pending ? "Leaving…" : "Leave") : pending ? "Removing…" : "Remove"}
        </Button>
      </div>
    </ModalCore>
  );
}
