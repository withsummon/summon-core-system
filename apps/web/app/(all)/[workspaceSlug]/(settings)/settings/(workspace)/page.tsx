/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useOutletContext } from "react-router";
import { useQuery } from "convex/react";
import { api } from "@summon/convex/api";
import { WORKSPACE_SETTINGS } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
import { PageHead } from "@/components/core/page-title";
import { WorkspaceDetails } from "@/components/workspace/settings/workspace-details";
import { PreservedWorkspaceSettingsShell } from "@/components/workspace/native-shell/workspace-shell";
import { useStickiesCommands } from "@/components/stickies/native/provider";
import type { WorkspaceSession } from "../../../../../native-workspace";
import { GeneralWorkspaceSettingsHeader } from "./header";

export default function GeneralWorkspaceSettingsPage() {
  const session = useOutletContext<WorkspaceSession>();
  const { workspace } = session;
  const { t } = useTranslation();
  const metadata = useQuery(
    api.settings.index.metadata,
    workspace.membershipRole === "guest" ? "skip" : { workspaceId: workspace._id }
  );
  const commands = useStickiesCommands();
  return (
    <>
      <PageHead title={t("workspace_settings.page_label", { workspace: workspace.name })} />
      <PreservedWorkspaceSettingsShell
        {...session}
        activePath={WORKSPACE_SETTINGS.general.i18n_label}
        header={<GeneralWorkspaceSettingsHeader />}
      >
        {metadata ? (
          <WorkspaceDetails
            key={workspace._id}
            workspaceId={workspace._id}
            metadata={metadata}
            beforeDelete={commands.flushAll}
          />
        ) : (
          <p role="status">Loading workspace settings…</p>
        )}
      </PreservedWorkspaceSettingsShell>
    </>
  );
}
