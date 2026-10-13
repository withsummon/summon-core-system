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
import { useSummonAccess } from "@/components/summon/use-summon-access";

type TSettingsTab = "general" | "users";

/** Summon Settings: one header, General | Users tabs, and the admin-only gate for both. */
export function SummonSettingsFrame(props: {
  workspaceSlug: string;
  tab: TSettingsTab;
  description: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const { workspaceSlug, tab, description, actions, children } = props;
  const { can, isLoading, error } = useSummonAccess(workspaceSlug);
  const allowed = can("settings.view");

  return (
    <SummonScreen title="Settings" description={description} actions={allowed ? actions : undefined}>
      <SectionTabs
        label="Settings sections"
        value={tab}
        items={[
          { value: "general", label: "General", icon: GearSixIcon, href: `/${workspaceSlug}/summon/settings` },
          { value: "users", label: "Users", icon: UsersThreeIcon, href: `/${workspaceSlug}/summon/settings/users` },
        ]}
      />
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
