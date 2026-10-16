/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { ReactNode } from "react";
import { GearSixIcon, UsersThreeIcon } from "@phosphor-icons/react";
import { SummonRequestState } from "@/components/summon/request-state";
import { SummonScreen } from "@/components/summon/screen";
import { SectionTabs } from "@/components/summon/section-tabs";
import { InvitePeopleAction } from "@/components/summon/settings/invite-people-action";
import { useSummonAccess } from "@/components/summon/use-summon-access";

export type TSettingsTab = "general" | "users";

const DESCRIPTIONS: Record<TSettingsTab, string> = {
  general: "Workspace identity and business settings.",
  users: "Who can sign in to this workspace, and what their role lets them do.",
};

/**
 * Summon Settings: one header, General | Users tabs, and the admin-only gate for both. The Settings layout route
 * renders it once around both tabs' routes, so switching tabs keeps it mounted and the underline slides.
 */
export function SummonSettingsFrame(props: { workspaceSlug: string; tab: TSettingsTab; children: ReactNode }) {
  const { workspaceSlug, tab, children } = props;
  const { can, isLoading, error } = useSummonAccess(workspaceSlug);
  const allowed = can("settings.view");

  return (
    <SummonScreen
      title="Settings"
      description={DESCRIPTIONS[tab]}
      actions={allowed && tab === "users" ? <InvitePeopleAction workspaceSlug={workspaceSlug} /> : undefined}
    >
      {/* Every settings route shows these tabs, so they stay still on a switch like the header. */}
      <div data-page-chrome>
        <SectionTabs
          label="Settings sections"
          value={tab}
          items={[
            { value: "general", label: "General", icon: GearSixIcon, href: `/${workspaceSlug}/summon/settings` },
            { value: "users", label: "Users", icon: UsersThreeIcon, href: `/${workspaceSlug}/summon/settings/users` },
          ]}
        />
      </div>
      {allowed ? (
        children
      ) : (
        <SummonRequestState
          loading={isLoading}
          error={error}
          permissionError={!isLoading && !error}
          permissionMessage="Only workspace admins can open Settings. Ask an admin if you need a change."
        />
      )}
    </SummonScreen>
  );
}
