/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useOutletContext } from "react-router";
// component
import { WORKSPACE_SETTINGS } from "@plane/constants";
import { NotAuthorizedView } from "@/components/auth-screens/not-authorized-view";
import { PageHead } from "@/components/core/page-title";
import { PreservedWorkspaceSettingsShell } from "@/components/workspace/native-shell/workspace-shell";
// hooks
import type { WorkspaceSession } from "@/components/workspace/native-shell/session";
// local imports
import { BillingWorkspaceSettingsHeader } from "./header";
import { BillingRoot } from "@/components/workspace/billing";

function BillingSettingsPage() {
  const session = useOutletContext<WorkspaceSession>();
  const { workspace } = session;
  return (
    <PreservedWorkspaceSettingsShell
      {...session}
      activePath={WORKSPACE_SETTINGS["billing-and-plans"].i18n_label}
      header={<BillingWorkspaceSettingsHeader />}
      hugging
    >
      <PageHead title={`${workspace.name} - Billing & Plans`} />
      {workspace.membershipRole === "admin" ? (
        <BillingRoot />
      ) : (
        <NotAuthorizedView section="settings" className="h-auto" />
      )}
    </PreservedWorkspaceSettingsShell>
  );
}

export default BillingSettingsPage;
