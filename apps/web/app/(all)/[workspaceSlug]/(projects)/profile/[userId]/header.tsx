/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { FunctionReturnType } from "convex/server";
import type { api } from "@summon/convex/api";
import { PanelRight } from "lucide-react";
import { PROFILE_VIEWER_TAB, PROFILE_ADMINS_TAB } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
import { ChevronDownIcon, YourWorkIcon } from "@plane/propel/icons";
import { Button } from "@plane/propel/button";
import { Header, Breadcrumbs, CustomMenu } from "@plane/ui";
import { BreadcrumbLink } from "@/components/common/breadcrumb-link";

export type ProfileTab = (typeof PROFILE_VIEWER_TAB | typeof PROFILE_ADMINS_TAB)[number];

export function UserProfileHeader({
  workspaceSlug,
  subject,
  activeTab,
  collapsed,
  onToggle,
  filters,
}: {
  workspaceSlug: string;
  subject: FunctionReturnType<typeof api.tasks.profile.subject>;
  activeTab: ProfileTab;
  collapsed: boolean;
  onToggle: () => void;
  filters?: ReactNode;
}) {
  const router = useRouter();
  const { t } = useTranslation();
  const tabs = subject.canViewTaskTabs ? [...PROFILE_VIEWER_TAB, ...PROFILE_ADMINS_TAB] : PROFILE_VIEWER_TAB;
  const name = `${subject.firstName} ${subject.lastName}`.trim();
  const breadcrumb = subject.canEditProfile ? t("profile.page_label") : `${name} ${t("profile.work")}`;

  return (
    <Header>
      <Header.LeftItem>
        <Breadcrumbs>
          <Breadcrumbs.Item
            component={
              <BreadcrumbLink
                label={breadcrumb}
                disableTooltip
                icon={<YourWorkIcon className="h-4 w-4 text-tertiary" />}
              />
            }
          />
        </Breadcrumbs>
      </Header.LeftItem>
      <Header.RightItem>
        <div className="hidden md:flex md:items-center">{filters}</div>
        <div className="flex gap-4 md:hidden">
          <CustomMenu
            maxHeight="md"
            className="flex flex-grow justify-center text-13 text-secondary"
            placement="bottom-start"
            customButton={
              <div className="flex items-center gap-2 rounded-md border border-subtle px-2 py-1.5">
                <span className="flex flex-grow justify-center text-13 text-secondary">{t(activeTab.i18n_label)}</span>
                <ChevronDownIcon className="h-4 w-4 text-placeholder" />
              </div>
            }
            customButtonClassName="flex flex-grow justify-center text-secondary text-13"
            closeOnSelect
          >
            {tabs.map((tab) => (
              <CustomMenu.MenuItem
                className="flex items-center gap-2"
                key={tab.route}
                onClick={() => router.push(`/${workspaceSlug}/profile/${subject.userId}/${tab.route}`)}
              >
                <span className="w-full text-tertiary">{t(tab.i18n_label)}</span>
              </CustomMenu.MenuItem>
            ))}
          </CustomMenu>
          <Button
            variant="ghost"
            size="lg"
            aria-label={t("profile.label")}
            aria-expanded={!collapsed}
            aria-controls="profile-details"
            data-prevent-outside-click
            onClick={onToggle}
            appendIcon={<PanelRight className={!collapsed ? "text-accent-primary" : "text-secondary"} />}
          />
        </div>
      </Header.RightItem>
    </Header>
  );
}
