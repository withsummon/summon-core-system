/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import type { FunctionReturnType } from "convex/server";
import { api } from "@summon/convex/api";
import { useTranslation } from "@plane/i18n";
import { Button } from "@plane/propel/button";
import type { NativeWorkspace } from "@/components/workspace/native-shell/session";
import { WebhookSecretKey } from "./form";

type Props = {
  workspace: NativeWorkspace;
  created: FunctionReturnType<typeof api.webhooks.actions.create>;
  handleClose: () => void;
  onPendingChange: (pending: boolean) => void;
};
export function GeneratedHookDetails({ workspace, created, handleClose, onPendingChange }: Props) {
  const [webhook, setWebhook] = useState(created.webhook);
  const { t } = useTranslation();
  return (
    <>
      <div className="space-y-5 p-5">
        <div className="space-y-3">
          <h3 className="text-18 font-medium text-secondary">{t("workspace_settings.key_created")}</h3>
          <p className="text-13 text-placeholder">{t("workspace_settings.copy_key")}</p>
        </div>
        <WebhookSecretKey
          workspace={workspace}
          data={webhook}
          initialSecretKey={created.secretKey}
          onRegenerated={setWebhook}
          onPendingChange={onPendingChange}
        />
      </div>
      <div className="flex items-center justify-end gap-2 border-t-[0.5px] border-subtle px-5 py-4">
        <Button variant="secondary" size="lg" onClick={handleClose}>
          Close
        </Button>
      </div>
    </>
  );
}
