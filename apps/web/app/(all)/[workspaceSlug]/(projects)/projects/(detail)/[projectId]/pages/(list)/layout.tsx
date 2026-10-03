/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { Outlet, useNavigate, useOutletContext } from "react-router";
import { useQuery } from "convex/react";
import { useTheme } from "next-themes";
import { api } from "@summon/convex/api";
import { useTranslation } from "@plane/i18n";
import darkPagesAsset from "@/app/assets/empty-state/disabled-feature/pages-dark.webp?url";
import lightPagesAsset from "@/app/assets/empty-state/disabled-feature/pages-light.webp?url";
import { DetailedEmptyState } from "@/components/empty-state/detailed-empty-state-root";
import { PreservedWorkspaceShell } from "@/components/workspace/native-shell/workspace-shell";
import { useStickiesCommands } from "@/components/stickies/native/provider";
import type { WorkspaceSession } from "@/app/native-workspace";
import type { Route } from "./+types/layout";

export default function ProjectPagesLayout({ params }: Route.ComponentProps) {
  const session = useOutletContext<WorkspaceSession>();
  const commands = useStickiesCommands();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { resolvedTheme } = useTheme();
  const address = useQuery(api.navigation.address.resolveProjectId, {
    workspaceId: session.workspace._id,
    projectId: params.projectId,
  });
  const config = useQuery(api.projects.features.get, address ? { projectId: address.project._id } : "skip");
  return (
    <PreservedWorkspaceShell
      {...session}
      onCreateSticky={commands.create}
      onOpenStickies={commands.openAll}
      beforeLeave={commands.flushAll}
    >
      <div className="flex h-full min-h-0 flex-col">
        {!address || !config ? (
          <p role="status" className="p-6">
            Loading pages…
          </p>
        ) : !config.features.pages ? (
          <div className="flex h-full items-center justify-center">
            <DetailedEmptyState
              title={t("disabled_project.empty_state.page.title")}
              description={t("disabled_project.empty_state.page.description")}
              assetPath={resolvedTheme === "light" ? lightPagesAsset : darkPagesAsset}
              primaryButton={{
                text: t("disabled_project.empty_state.page.primary_button.text"),
                onClick: () => navigate(`/${session.workspace.slug}/settings/projects/${address.project._id}/features`),
                disabled: !config.canConfigure,
              }}
            />
          </div>
        ) : (
          <Outlet context={address} />
        )}
      </div>
    </PreservedWorkspaceShell>
  );
}
