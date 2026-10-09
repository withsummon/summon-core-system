/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import type { FunctionReturnType } from "convex/server";
import { api } from "@summon/convex/api";
import { csvDownload } from "@plane/utils";
import { getCurrentHookAsCSV } from "./utils";
import { useTranslation } from "@plane/i18n";
import { Dialog } from "@plane/propel/dialog";
import { EModalPosition, EModalWidth, ModalCore } from "@plane/ui";
import type { NativeWorkspace } from "@/components/workspace/native-shell/session";
import { WebhookForm } from "./form";
import { GeneratedHookDetails } from "./generated-hook-details";

type Props = {
  workspace: NativeWorkspace;
  options: FunctionReturnType<typeof api.webhooks.index.options>;
  onClose: () => void;
};
export function CreateWebhookModal({ workspace, options, onClose }: Props) {
  const [created, setCreated] = useState<FunctionReturnType<typeof api.webhooks.actions.create> | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const { t } = useTranslation();
  const close = () => {
    if (!pending) onClose();
  };
  return (
    <ModalCore
      isOpen
      handleClose={() => {
        if (!created) close();
      }}
      position={EModalPosition.TOP}
      width={EModalWidth.XXL}
      className="p-4 pb-0"
    >
      <Dialog.Title className="sr-only">{t("workspace_settings.settings.webhooks.modal.title")}</Dialog.Title>
      {downloadError && (
        <p role="alert" className="text-13 text-danger-primary">
          {downloadError}
        </p>
      )}
      {created ? (
        <GeneratedHookDetails
          workspace={workspace}
          created={created}
          handleClose={close}
          onPendingChange={setPending}
        />
      ) : (
        <WebhookForm
          workspace={workspace}
          options={options}
          handleClose={close}
          onCreated={(result) => {
            setCreated(result);
            try {
              csvDownload(
                getCurrentHookAsCSV(workspace, result.webhook, result.secretKey),
                `webhook-secret-key-${Date.now()}`
              );
            } catch {
              setDownloadError("Webhook created. CSV download failed; copy the key below.");
            }
          }}
          onPendingChange={setPending}
        />
      )}
    </ModalCore>
  );
}
