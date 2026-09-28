/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useNavigate, useOutletContext } from "react-router";
import { useQuery } from "convex/react";
import { api } from "@summon/convex/api";
import { EUserWorkspaceRoles } from "@plane/types";
import { ROLE_DETAILS, WORKSPACE_SETTINGS } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
import { PageHead } from "@/components/core/page-title";
import { NotAuthorizedView } from "@/components/auth-screens/not-authorized-view";
import { SettingsContentWrapper } from "@/components/settings/content-wrapper";
import { SettingsMobileNav } from "@/components/settings/mobile/nav";
import { WorkspaceSettingsSidebarView } from "@/components/settings/workspace/sidebar/root";
import { WorkspaceSettingsSidebarHeaderView } from "@/components/settings/workspace/sidebar/header";
import { WorkspaceSettingsSidebarItemCategoriesView } from "@/components/settings/workspace/sidebar/item-categories";
import { WorkspaceContentFrame } from "@/components/workspace/content-frame";
import { WorkspaceDetails } from "@/components/workspace/settings/workspace-details";
import { NativeWorkspaceTopNavigation } from "@/components/workspace/native-shell/workspace-shell";
import { StickyCommands } from "@/components/workspace/native-shell/commands";
import { useStickiesCommands } from "@/components/stickies/native/provider";
import { AuthenticatedAssetImage } from "@/components/convex-core/assets/image";
import type { WorkspaceSession } from "../../../../../native-workspace";
import { GeneralWorkspaceSettingsHeader } from "./header";

export default function GeneralWorkspaceSettingsPage() {
  const { user, workspace, workspaces } = useOutletContext<WorkspaceSession>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const metadata = useQuery(
    api.settings.index.metadata,
    workspace.membershipRole === "guest" ? "skip" : { workspaceId: workspace._id }
  );
  const commands = useStickiesCommands();
  const role = {
    admin: EUserWorkspaceRoles.ADMIN,
    member: EUserWorkspaceRoles.MEMBER,
    guest: EUserWorkspaceRoles.GUEST,
  }[workspace.membershipRole];
  const openStickies = () => navigate(`/${workspace.slug}/stickies/`);
  const create = async () => {
    await commands.create();
    commands.openAll();
  };
  const sidebar = (onNavigate?: () => void) => (
    <WorkspaceSettingsSidebarView
      header={
        <WorkspaceSettingsSidebarHeaderView
          name={workspace.name}
          roleLabel={t(ROLE_DETAILS[role].i18n_title)}
          onGoBack={openStickies}
          logo={
            <div className="relative grid size-8 shrink-0 place-items-center overflow-hidden rounded-md border border-subtle bg-accent-primary text-on-color uppercase">
              {workspace.logo ? (
                <AuthenticatedAssetImage
                  asset={workspace.logo}
                  alt="Workspace logo"
                  className="absolute inset-0 size-full object-cover"
                />
              ) : (
                workspace.name[0]
              )}
            </div>
          }
        />
      }
    >
      <WorkspaceSettingsSidebarItemCategoriesView
        workspaceSlug={workspace.slug}
        isAccessible={(access) => access.includes(role)}
        onNavigate={onNavigate}
      />
    </WorkspaceSettingsSidebarView>
  );
  return (
    <WorkspaceContentFrame
      shouldRenderAppRail={false}
      appRail={null}
      topNavigation={
        <NativeWorkspaceTopNavigation
          workspace={workspace}
          workspaces={workspaces}
          user={user}
          powerK={<StickyCommands onCreateSticky={create} onOpenStickies={commands.openAll} />}
          beforeLeave={commands.flushAll}
        />
      }
    >
      <PageHead title={t("workspace_settings.page_label", { workspace: workspace.name })} />
      <div className="flex size-full min-h-0 min-w-0 flex-col overflow-hidden rounded-lg border border-subtle bg-surface-1">
        <SettingsMobileNav activePath={WORKSPACE_SETTINGS.general.i18n_label}>{sidebar}</SettingsMobileNav>
        <div className="flex size-full min-h-0 min-w-0">
          <div className="hidden h-full shrink-0 md:block">{sidebar()}</div>
          {workspace.membershipRole === "guest" ? (
            <NotAuthorizedView section="settings" className="h-auto" />
          ) : (
            <SettingsContentWrapper header={<GeneralWorkspaceSettingsHeader />}>
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
            </SettingsContentWrapper>
          )}
        </div>
      </div>
    </WorkspaceContentFrame>
  );
}
