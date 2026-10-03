/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */
import { useCallback, useState } from "react";
import { useAction, useMutation } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "@summon/convex/api";
import { AlertModalCore } from "@plane/ui";
import { mutationMessage } from "@/components/convex-core/commercial/forms";
import useReloadConfirmations from "@/hooks/use-reload-confirmation";
const draftActions = {
  copy: {
    title: "Make a copy",
    description: "Copy this private draft and its ready files? The copy remains unpublished.",
    action: "Make a copy",
  },
  remove: {
    title: "Delete draft",
    description: "Move this private draft to Trash? You can restore it later.",
    action: "Delete",
  },
  restore: { title: "Restore draft", description: "Restore this private draft to your collection?", action: "Restore" },
};

export function WorkspaceDraftIssueDeleteIssueModal({
  draft,
  operation,
  onClose,
  onCopy,
}: {
  draft: FunctionReturnType<typeof api.tasks.drafts.index.list>["page"][number];
  operation: keyof typeof draftActions;
  onClose: () => void;
  onCopy: (id: FunctionReturnType<typeof api.tasks.drafts.copy.run>) => void;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const copy = useAction(api.tasks.drafts.copy.run);
  const lifecycle = useMutation(api.tasks.drafts.index.lifecycle);
  const leave = useCallback(onClose, [onClose]);
  const release = useReloadConfirmations(pending, "The draft operation is still in progress.", leave, pending);
  const labels = draftActions[operation];
  return (
    <AlertModalCore
      isOpen
      isSubmitting={pending}
      variant={operation === "remove" ? "danger" : "primary"}
      handleClose={() => {
        if (!pending) onClose();
      }}
      handleSubmit={async () => {
        if (pending) return;
        setPending(true);
        setError("");
        try {
          const receipt = { draftId: draft._id, expectedUpdatedAt: draft.updatedAt };
          if (operation === "copy") {
            const copiedId = await copy(receipt);
            release((allow) => {
              if (allow) onCopy(copiedId);
            });
          } else {
            await lifecycle({ ...receipt, deleted: operation === "remove" });
            release((allow) => {
              if (allow) onClose();
            });
          }
        } catch (failure) {
          setError(mutationMessage(failure));
        } finally {
          setPending(false);
        }
      }}
      title={labels.title}
      content={
        <>
          {labels.description}
          {error && (
            <span role="alert" className="mt-3 block text-danger-primary">
              {error}
            </span>
          )}
        </>
      }
      primaryButtonText={{ default: labels.action, loading: "Working…" }}
      secondaryButtonText="Cancel"
    />
  );
}
