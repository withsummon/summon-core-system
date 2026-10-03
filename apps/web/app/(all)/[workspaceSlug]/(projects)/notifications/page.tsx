/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useOutletContext } from "react-router";
import { useTranslation } from "@plane/i18n";
import type { WorkspaceSession } from "@/components/workspace/native-shell/session";
import { PageHead } from "@/components/core/page-title";
import { Notifications } from "@/components/convex-core/notifications/notifications";
import { useStickiesCommands } from "@/components/stickies/native/provider";
import { PreservedWorkspaceShell } from "@/components/workspace/native-shell/workspace-shell";

export default function WorkspaceNotificationsPage() {
  const session = useOutletContext<WorkspaceSession>();
  const commands = useStickiesCommands();
  const { t } = useTranslation();
  return (
    <PreservedWorkspaceShell
      {...session}
      onCreateSticky={commands.create}
      onOpenStickies={commands.openAll}
      beforeLeave={commands.flushAll}
    >
      <PageHead title={t("notification.page_label", { workspace: session.workspace.name })} />
      <Notifications workspace={session.workspace} />
    </PreservedWorkspaceShell>
  );
}
