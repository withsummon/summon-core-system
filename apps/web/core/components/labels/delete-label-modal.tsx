/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@summon/convex/api";
import { Button } from "@plane/propel/button";
import { Dialog } from "@plane/propel/dialog";
import { ModalCore, EModalPosition, EModalWidth } from "@plane/ui";
import useReloadConfirmations from "@/hooks/use-reload-confirmation";
import { mutationMessage } from "@/components/convex-core/commercial/forms";
import type { ProjectLabel } from "./create-update-label-inline";

export function DeleteLabelModal({
  label,
  canManage,
  onClose,
}: {
  label: ProjectLabel;
  canManage: boolean;
  onClose: () => void;
}) {
  const [snapshot] = useState(label);
  const begin = useMutation(api.tasks.label_removal.begin);
  const [pending, setPending] = useState(false),
    [error, setError] = useState("");
  const release = useReloadConfirmations(pending, "Label deletion is still starting.", undefined, pending);
  const close = () => {
    if (!pending) {
      release();
      onClose();
    }
  };
  return (
    <ModalCore isOpen handleClose={close} position={EModalPosition.CENTER} width={EModalWidth.XXL}>
      <section className="space-y-4 p-6">
        <Dialog.Title className="text-18 font-medium">Delete Label</Dialog.Title>
        <Dialog.Description className="text-14 text-secondary">
          Delete {snapshot.name} and its child labels? This removes their references from work items, private drafts,
          documents and view filters. Continue the deletion below once cleanup starts.
        </Dialog.Description>
        {error && (
          <p role="alert" className="text-13 text-danger-primary">
            {error}
          </p>
        )}
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="secondary" disabled={pending} onClick={close}>
            Cancel
          </Button>
          <Button
            variant="error-fill"
            disabled={!canManage}
            loading={pending}
            onClick={async () => {
              if (pending || !canManage) return;
              setPending(true);
              setError("");
              try {
                await begin({ labelId: snapshot._id, expectedRevision: snapshot.revision });
                release();
                onClose();
              } catch (failure) {
                setError(mutationMessage(failure));
              } finally {
                setPending(false);
              }
            }}
          >
            Delete
          </Button>
        </div>
      </section>
    </ModalCore>
  );
}
