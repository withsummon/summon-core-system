/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

// components
import { observer } from "mobx-react";
import { useParams, usePathname } from "next/navigation";
import { cn } from "@plane/utils";
import { TopNavPowerK } from "@/components/navigation";
import { SummonThemeToggle } from "@/components/summon/theme-toggle";
import { HelpMenuRoot } from "@/components/workspace/sidebar/help-section/root";
import { UserMenuRoot } from "@/components/workspace/sidebar/user-menu-root";
import { WorkspaceMenuRoot } from "@/components/workspace/sidebar/workspace-menu-root";
import { useAppRailPreferences } from "@/hooks/use-navigation-preferences";
import { InboxIcon, SearchIcon } from "@plane/propel/icons";
import Link from "next/link";
import useSWR from "swr";
import { useWorkspaceNotifications } from "@/hooks/store/notifications";
import { useAppTheme } from "@/hooks/store/use-app-theme";
import { usePowerK } from "@/hooks/store/use-power-k";
import { useUserProfile } from "@/hooks/store/user";
import { AppSidebarToggleButton } from "@/components/sidebar/sidebar-toggle-button";

export const TopNavigationRoot = observer(function TopNavigationRoot() {
  // router
  const { workspaceSlug } = useParams();
  const pathname = usePathname();

  // store hooks
  const { unreadNotificationsCount, getUnreadNotificationsCount } = useWorkspaceNotifications();
  const { sidebarCollapsed } = useAppTheme();
  const { updateUserTheme } = useUserProfile();
  const { togglePowerKModal } = usePowerK();
  const { preferences } = useAppRailPreferences();

  const showLabel = preferences.displayMode === "icon_with_label";

  // Fetch notification count
  useSWR(
    workspaceSlug ? "WORKSPACE_UNREAD_NOTIFICATION_COUNT" : null,
    workspaceSlug ? () => getUnreadNotificationsCount(workspaceSlug.toString()) : null
  );

  // Calculate notification count
  const isMentionsEnabled = unreadNotificationsCount.mention_unread_notifications_count > 0;
  const totalNotifications = isMentionsEnabled
    ? unreadNotificationsCount.mention_unread_notifications_count
    : unreadNotificationsCount.total_unread_notifications_count;

  return (
    <div
      className={cn("z-[27] flex min-h-10 w-full items-center bg-canvas px-3.5 transition-[padding] duration-300", {
        "px-2": !showLabel,
      })}
    >
      <div className={cn("mr-1 max-md:hidden", !sidebarCollapsed && "md:hidden")}>
        <AppSidebarToggleButton />
      </div>
      {/* Workspace Menu */}
      <div className="flex min-w-0 flex-1">
        <WorkspaceMenuRoot variant="top-navigation" />
      </div>
      {/* Power K Search: an inline field from md up, an icon that opens the palette on a phone */}
      <div className="hidden shrink-0 md:block">
        <TopNavPowerK />
      </div>
      {/* Additional Actions */}
      <div className="flex flex-none items-center justify-end gap-1 md:flex-1">
        <button
          type="button"
          aria-label="Search"
          title="Search"
          onClick={() => togglePowerKModal(true)}
          className="grid size-8 place-items-center rounded-md text-tertiary hover:bg-layer-transparent-hover md:hidden"
        >
          <SearchIcon className="size-5" />
        </button>
        <Link
          href={`/${workspaceSlug?.toString()}/notifications/`}
          aria-label="Inbox"
          title="Inbox"
          className={cn("grid size-8 place-items-center rounded-md text-tertiary hover:bg-layer-transparent-hover", {
            "bg-layer-transparent-selected text-secondary": pathname?.includes("/notifications/"),
          })}
        >
          <span className="relative">
            <InboxIcon className="size-5" />
            {totalNotifications > 0 && (
              <span className="absolute top-0 right-0 size-2 rounded-full bg-danger-primary" />
            )}
          </span>
        </Link>
        {/* On a phone, Help drops and the theme switch moves into the tab bar's More sheet */}
        <div className="hidden items-center gap-1 md:flex">
          <HelpMenuRoot />
          <SummonThemeToggle onChange={(theme) => updateUserTheme({ theme })} />
        </div>
        <div className="flex size-8 items-center justify-center rounded-md hover:bg-layer-1-hover">
          <UserMenuRoot />
        </div>
      </div>
    </div>
  );
});
