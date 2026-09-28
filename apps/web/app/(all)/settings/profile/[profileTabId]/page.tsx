/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { Navigate } from "react-router";
import { useQuery } from "convex/react";
import { api } from "@summon/convex/api";
// plane imports
import { PROFILE_SETTINGS_TABS } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
// components
import { LogoSpinner } from "@/components/common/logo-spinner";
import { PageHead } from "@/components/core/page-title";
import { ProfileSettingsContent } from "@/components/settings/profile/content";
import { ProfileSettingsSidebarRoot } from "@/components/settings/profile/sidebar";
// hooks
import { useAppRouter } from "@/hooks/use-app-router";
// local imports
import type { Route } from "../+types/layout";

function ProfileSettingsPage(props: Route.ComponentProps) {
  const { profileTabId } = props.params;
  // router
  const router = useAppRouter();
  // store hooks
  const currentUser = useQuery(api.identity.profile.get);
  // translation
  const { t } = useTranslation();
  // derived values
  const tab = PROFILE_SETTINGS_TABS.find((item) => item === profileTabId);

  if (!tab) return <Navigate to="/settings/profile/general" replace />;

  if (!currentUser)
    return (
      <div className="grid size-full place-items-center px-4">
        <LogoSpinner />
      </div>
    );

  return (
    <>
      <PageHead title={`${t("profile.label")} - ${t("general_settings")}`} />
      <div className="relative size-full">
        <div className="flex size-full flex-col md:flex-row">
          <ProfileSettingsSidebarRoot
            activeTab={tab}
            className="w-[250px]"
            updateActiveTab={(selectedTab) => router.push(`/settings/profile/${selectedTab}`)}
          />
          <ProfileSettingsContent activeTab={tab} className="mx-auto w-full max-w-225 grow px-page-x py-6 md:py-20" />
        </div>
      </div>
    </>
  );
}

export default ProfileSettingsPage;
