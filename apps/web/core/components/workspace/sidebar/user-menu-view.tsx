/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { ReactNode } from "react";
import { LogOut, Settings, Settings2 } from "lucide-react";
import { useTranslation } from "@plane/i18n";
import { CustomMenu } from "@plane/ui";
import { CoverImage } from "@/components/common/cover-image";
export function UserMenuView({
  displayName,
  firstName,
  lastName,
  email,
  coverUrl,
  smallAvatar,
  largeAvatar,
  onSettings,
  onPreferences,
  onSignOut,
  onOpenChange,
}: {
  displayName: string | undefined;
  firstName: string | undefined;
  lastName: string | undefined;
  email: string | null | undefined;
  coverUrl?: string | null;
  smallAvatar: ReactNode;
  largeAvatar: ReactNode;
  onSettings: () => void;
  onPreferences: () => void;
  onSignOut: () => void;
  onOpenChange?: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  return (
    <CustomMenu
      ariaLabel={t("aria_labels.projects_sidebar.open_user_menu")}
      className="flex items-center"
      customButton={
        <span className="grid size-8 place-items-center rounded-md hover:bg-layer-transparent-hover">
          {smallAvatar}
        </span>
      }
      menuButtonOnClick={() => onOpenChange?.(true)}
      onMenuClose={() => onOpenChange?.(false)}
      placement="bottom-end"
      maxHeight="2xl"
      optionsClassName="w-72 p-3 flex flex-col gap-y-3"
      closeOnSelect
    >
      <div className="relative h-29 w-full rounded-lg">
        <CoverImage
          src={coverUrl ?? undefined}
          alt={displayName}
          className="h-29 w-full rounded-lg"
          showDefaultWhenEmpty
        />
        <div className="absolute inset-0 bg-layer-1/50" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
          <div className="flex flex-col items-center gap-y-2">
            <div>{largeAvatar}</div>
            <div className="text-center">
              <p className="text-body-sm-medium">
                {firstName} {lastName}
              </p>
              <p className="text-caption-md-regular">{email}</p>
            </div>
          </div>
        </div>
      </div>
      <div>
        <CustomMenu.MenuItem onClick={onSettings} className="flex items-center gap-2">
          <Settings className="size-3.5 shrink-0" />
          {t("settings")}
        </CustomMenu.MenuItem>
        <CustomMenu.MenuItem onClick={onPreferences} className="flex items-center gap-2">
          <Settings2 className="size-3.5 shrink-0" />
          {t("preferences")}
        </CustomMenu.MenuItem>
      </div>
      <CustomMenu.MenuItem onClick={onSignOut} className="flex items-center gap-2">
        <LogOut className="size-3.5 shrink-0" />
        {t("sign_out")}
      </CustomMenu.MenuItem>
    </CustomMenu>
  );
}
