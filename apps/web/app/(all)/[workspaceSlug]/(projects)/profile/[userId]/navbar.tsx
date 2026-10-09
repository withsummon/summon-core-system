/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import Link from "next/link";
import type { FunctionReturnType } from "convex/server";
import type { api } from "@summon/convex/api";
import { PROFILE_VIEWER_TAB, PROFILE_ADMINS_TAB } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
import { Header, EHeaderVariant } from "@plane/ui";
import { cn } from "@plane/utils";
import type { ProfileTab } from "./header";

export function ProfileNavbar({
  workspaceSlug,
  subject,
  activeTab,
}: {
  workspaceSlug: string;
  subject: FunctionReturnType<typeof api.tasks.profile.subject>;
  activeTab: ProfileTab;
}) {
  const { t } = useTranslation();
  const tabs = subject.canViewTaskTabs ? [...PROFILE_VIEWER_TAB, ...PROFILE_ADMINS_TAB] : PROFILE_VIEWER_TAB;
  return (
    <Header variant={EHeaderVariant.SECONDARY} showOnMobile={false}>
      <div className="flex items-center overflow-x-scroll">
        {tabs.map((tab) => (
          <Link
            key={tab.route}
            href={`/${workspaceSlug}/profile/${subject.userId}/${tab.route}`}
            aria-current={activeTab.key === tab.key ? "page" : undefined}
          >
            <span
              className={cn(
                "flex border-b-2 p-4 text-13 font-medium whitespace-nowrap text-tertiary outline-none hover:text-primary",
                activeTab.key === tab.key
                  ? "border-accent-strong text-accent-primary hover:text-accent-primary"
                  : "border-transparent"
              )}
            >
              {t(tab.i18n_label)}
            </span>
          </Link>
        ))}
      </div>
    </Header>
  );
}
