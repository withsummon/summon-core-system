/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import { useAction } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "@summon/convex/api";
import { Eye, EyeOff, RefreshCw } from "lucide-react";
import { useTranslation } from "@plane/i18n";
import { Button } from "@plane/propel/button";
import { CopyIcon } from "@plane/propel/icons";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import { csvDownload, copyTextToClipboard } from "@plane/utils";
import type { NativeWorkspace } from "@/components/workspace/native-shell/session";
import { mutationMessage } from "@/components/convex-core/commercial/forms";
import useReloadConfirmations from "@/hooks/use-reload-confirmation";
import { getCurrentHookAsCSV } from "../utils";

type Props = {
  workspace: NativeWorkspace;
  data: FunctionReturnType<typeof api.webhooks.index.get>;
  initialSecretKey?: string;
  disabled?: boolean;
  onRegenerated: (webhook: FunctionReturnType<typeof api.webhooks.index.get>) => void;
  onPendingChange?: (pending: boolean) => void;
};

export function WebhookSecretKey({
  workspace,
  data,
  initialSecretKey,
  disabled,
  onRegenerated,
  onPendingChange,
}: Props) {
  const [secretKey, setSecretKey] = useState(initialSecretKey);
  const [pending, setPending] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const regenerate = useAction(api.webhooks.actions.regenerate);
  const { t } = useTranslation();
  useReloadConfirmations(pending, "Wait for the webhook secret operation to finish.", undefined, pending);
  const canManage = workspace.membershipRole === "admin";
  return (
    <div className="space-y-2">
      <div className="text-13 font-medium">{t("workspace_settings.settings.webhooks.secret_key.title")}</div>
      <div className="text-11 text-placeholder">{t("workspace_settings.settings.webhooks.secret_key.message")}</div>
      <div className="flex flex-col gap-4 md:flex-row md:items-center">
        <div className="flex h-8 max-w-lg flex-grow items-center justify-between self-stretch rounded-sm border border-subtle px-2">
          <div className="overflow-hidden font-medium select-none">
            <p className="truncate text-11">{showKey && secretKey ? secretKey : "••••••••••••••••••••••••••••••"}</p>
          </div>
          {secretKey && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                aria-label={showKey ? "Hide secret key" : "View secret key"}
                onClick={() => setShowKey(!showKey)}
                className="grid shrink-0 place-items-center"
              >
                {showKey ? <EyeOff className="size-3" /> : <Eye className="size-3" />}
              </button>
              <button
                type="button"
                aria-label="Copy secret key"
                className="grid shrink-0 place-items-center"
                onClick={async () => {
                  try {
                    await copyTextToClipboard(secretKey);
                    setToast({
                      type: TOAST_TYPE.SUCCESS,
                      title: t("success"),
                      message: t("workspace_settings.settings.webhooks.toasts.secret_key_copied.message"),
                    });
                  } catch {
                    setError(t("workspace_settings.settings.webhooks.toasts.secret_key_not_copied.message"));
                  }
                }}
              >
                <CopyIcon className="size-3" />
              </button>
            </div>
          )}
        </div>
        <Button
          type="button"
          variant="secondary"
          size="lg"
          loading={pending}
          disabled={disabled || !canManage}
          prependIcon={<RefreshCw />}
          onClick={async () => {
            setPending(true);
            onPendingChange?.(true);
            setError(null);
            try {
              const result = await regenerate({
                workspaceId: workspace._id,
                webhookId: data._id,
                expectedRevision: data.revision,
              });
              setSecretKey(result.secretKey);
              setShowKey(false);
              onRegenerated(result.webhook);
              try {
                csvDownload(
                  getCurrentHookAsCSV(workspace, result.webhook, result.secretKey),
                  `webhook-secret-key-${Date.now()}`
                );
              } catch {
                setError("Key regenerated. CSV download failed; copy the key above.");
              }
              setToast({ type: TOAST_TYPE.SUCCESS, title: t("success"), message: "New key regenerated successfully." });
            } catch (failure) {
              setError(mutationMessage(failure));
            } finally {
              setPending(false);
              onPendingChange?.(false);
            }
          }}
        >
          {t("re_generate_key")}
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-13 text-danger-primary">
          {error}
        </p>
      )}
    </div>
  );
}
