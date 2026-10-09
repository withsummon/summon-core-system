/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import { useOutletContext } from "react-router";
import type { FunctionReturnType } from "convex/server";
import { WORKSPACE_SETTINGS } from "@plane/constants";
import { useQuery, usePaginatedQuery } from "convex/react";
import { api } from "@summon/convex/api";
import { useTranslation } from "@plane/i18n";
import { Button } from "@plane/propel/button";
import { EmptyStateCompact } from "@plane/propel/empty-state";
import { NotAuthorizedView } from "@/components/auth-screens/not-authorized-view";
import { PageHead } from "@/components/core/page-title";
import { SettingsHeading } from "@/components/settings/heading";
import { WebhookSettingsLoader } from "@/components/ui/loader/settings/web-hook";
import { WebhooksList, CreateWebhookModal } from "@/components/web-hooks";
import type { WorkspaceSession } from "@/components/workspace/native-shell/session";
import { PreservedWorkspaceSettingsShell } from "@/components/workspace/native-shell/workspace-shell";
import { WebhooksWorkspaceSettingsHeader } from "./header";

export default function WebhooksListPage() {
  const session = useOutletContext<WorkspaceSession>();
  const { workspace } = session;
  const { t } = useTranslation();
  const [creating, setCreating] = useState<FunctionReturnType<typeof api.webhooks.index.options> | null>(null);
  const canManage = workspace.membershipRole === "admin";
  const options = useQuery(api.webhooks.index.options, canManage ? { workspaceId: workspace._id } : "skip");
  const webhooks = usePaginatedQuery(api.webhooks.index.list, canManage ? { workspaceId: workspace._id } : "skip", {
    initialNumItems: 20,
  });
  return (
    <PreservedWorkspaceSettingsShell
      {...session}
      activePath={WORKSPACE_SETTINGS.webhooks.i18n_label}
      header={<WebhooksWorkspaceSettingsHeader />}
    >
      <PageHead title={`${workspace.name} - ${t("workspace_settings.settings.webhooks.title")}`} />
      {creating && <CreateWebhookModal workspace={workspace} options={creating} onClose={() => setCreating(null)} />}
      {!canManage ? (
        <NotAuthorizedView section="settings" className="h-auto" />
      ) : !options || webhooks.status === "LoadingFirstPage" ? (
        <WebhookSettingsLoader />
      ) : (
        <div className="w-full">
          <SettingsHeading
            title={t("workspace_settings.settings.webhooks.title")}
            description={t("workspace_settings.settings.webhooks.description")}
            control={
              <Button variant="primary" size="lg" onClick={() => setCreating(options)}>
                {t("workspace_settings.settings.webhooks.add_webhook")}
              </Button>
            }
          />
          {webhooks.results.length ? (
            <div className="mt-4">
              <WebhooksList workspace={workspace} webhooks={webhooks.results} />
            </div>
          ) : webhooks.status === "Exhausted" ? (
            <EmptyStateCompact
              assetKey="webhook"
              title={t("settings_empty_state.webhooks.title")}
              description={t("settings_empty_state.webhooks.description")}
              actions={[{ label: t("settings_empty_state.webhooks.cta_primary"), onClick: () => setCreating(options) }]}
              align="start"
              rootClassName="py-20"
            />
          ) : null}
          {webhooks.status !== "Exhausted" && (
            <Button
              variant="secondary"
              className="mt-4"
              loading={webhooks.status === "LoadingMore"}
              onClick={() => webhooks.loadMore(20)}
            >
              Load more
            </Button>
          )}
        </div>
      )}
    </PreservedWorkspaceSettingsShell>
  );
}
