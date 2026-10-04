/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import { useOutletContext } from "react-router";
import { useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { WORKSPACE_SETTINGS } from "@plane/constants";
import { api } from "@summon/convex/api";
import { NotAuthorizedView } from "@/components/auth-screens/not-authorized-view";
import { LogoSpinner } from "@/components/common/logo-spinner";
import { PageHead } from "@/components/core/page-title";
import { DeleteWebhookModal, WebhookDeleteSection, WebhookForm } from "@/components/web-hooks";
import type { WorkspaceSession } from "@/components/workspace/native-shell/session";
import { PreservedWorkspaceSettingsShell } from "@/components/workspace/native-shell/workspace-shell";
import type { Route } from "./+types/page";
import { WebhookDetailsWorkspaceSettingsHeader } from "./header";

export default function WebhookDetailsPage({ params }: Route.ComponentProps) {
  const session = useOutletContext<WorkspaceSession>();
  const { workspace } = session;
  const canManage = workspace.membershipRole === "admin";
  const [deleting, setDeleting] = useState<FunctionReturnType<typeof api.webhooks.index.get> | null>(null);
  const data = useQuery(
    api.webhooks.index.get,
    canManage ? { workspaceId: workspace._id, webhookId: params.webhookId } : "skip"
  );
  const [reviewed, setReviewed] = useState<FunctionReturnType<typeof api.webhooks.index.get> | null>(null);
  const [reviewedOptions, setReviewedOptions] = useState<FunctionReturnType<typeof api.webhooks.index.options> | null>(
    null
  );
  const options = useQuery(api.webhooks.index.options, canManage ? { workspaceId: workspace._id } : "skip");
  if (data && options && data._id !== reviewed?._id) {
    setReviewed(data);
    setReviewedOptions(options);
  }
  return (
    <PreservedWorkspaceSettingsShell
      {...session}
      activePath={WORKSPACE_SETTINGS.webhooks.i18n_label}
      header={<WebhookDetailsWorkspaceSettingsHeader />}
    >
      <PageHead title={`${workspace.name} - Webhook`} />
      {deleting && <DeleteWebhookModal workspace={workspace} webhook={deleting} onClose={() => setDeleting(null)} />}
      {!canManage && <NotAuthorizedView section="settings" className="h-auto" />}
      {reviewed && reviewedOptions && reviewed._id === params.webhookId ? (
        data?.available === false ? (
          <p className="text-13 text-tertiary">This webhook has been deleted.</p>
        ) : (
          <div className="w-full space-y-8 overflow-y-auto">
            <WebhookForm
              key={reviewed._id}
              workspace={workspace}
              options={reviewedOptions}
              data={reviewed}
              onUpdated={setReviewed}
            />
            {canManage && <WebhookDeleteSection openDeleteModal={() => setDeleting(reviewed)} />}
          </div>
        )
      ) : canManage ? (
        <div className="grid h-full place-items-center p-4">
          <LogoSpinner />
        </div>
      ) : null}
    </PreservedWorkspaceSettingsShell>
  );
}
