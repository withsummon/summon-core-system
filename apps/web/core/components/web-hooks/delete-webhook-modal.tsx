/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import { useNavigate } from "react-router";
import { useMutation } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "@summon/convex/api";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import { AlertModalCore } from "@plane/ui";
import type { NativeWorkspace } from "@/components/workspace/native-shell/session";
import { mutationMessage } from "@/components/convex-core/commercial/forms";
import useReloadConfirmations from "@/hooks/use-reload-confirmation";

type Props = {
  workspace: NativeWorkspace;
  webhook: FunctionReturnType<typeof api.webhooks.index.get>;
  onClose: () => void;
};
export function DeleteWebhookModal({ workspace, webhook, onClose }: Props) {
  const [reviewed] = useState(webhook);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const remove = useMutation(api.webhooks.index.remove);
  const navigate = useNavigate();
  const release = useReloadConfirmations(pending, "Wait for webhook deletion to finish.", undefined, pending);
  return (
    <AlertModalCore
      isOpen
      isSubmitting={pending}
      title="Delete webhook"
      handleClose={() => {
        if (!pending) {
          release();
          onClose();
        }
      }}
      handleSubmit={async () => {
        if (workspace.membershipRole !== "admin") {
          setError("Only workspace administrators can manage webhooks.");
          return;
        }
        setPending(true);
        setError(null);
        try {
          await remove({ workspaceId: workspace._id, webhookId: reviewed._id, expectedRevision: reviewed.revision });
          setToast({ type: TOAST_TYPE.SUCCESS, title: "Success!", message: "Webhook deleted successfully." });
          release((allowDefaultNavigation) => {
            onClose();
            if (allowDefaultNavigation) navigate(`/${workspace.slug}/settings/webhooks/`, { replace: true });
          });
        } catch (failure) {
          setError(mutationMessage(failure));
        } finally {
          setPending(false);
        }
      }}
      content={
        <>
          <p>
            Are you sure you want to delete this webhook? Future events will not be delivered to this webhook. This
            action cannot be undone.
          </p>
          {error && (
            <p role="alert" className="mt-3 text-danger-primary">
              {error}
            </p>
          )}
        </>
      }
    />
  );
}
