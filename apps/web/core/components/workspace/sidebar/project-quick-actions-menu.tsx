/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useRouter } from "next/navigation";
import { Settings, Share2, LogOut, MoreHorizontal } from "lucide-react";
// plane imports
import { MEMBER_TRACKER_ELEMENTS } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
import { LinkIcon, ArchiveIcon } from "@plane/propel/icons";
import { CustomMenu } from "@plane/ui";
import { cn } from "@plane/utils";

type Props = {
  workspaceSlug: string;
  projectId: string;
  isAdmin: boolean;
  isAuthorized: boolean;
  isMenuActive: boolean;
  setIsMenuActive: (value: boolean) => void;
  handleCopyText: () => void;
  onPublish: () => void;
  onLeave: () => void;
};

export function ProjectQuickActionsMenu({
  workspaceSlug,
  projectId,
  isAdmin,
  isAuthorized,
  isMenuActive,
  setIsMenuActive,
  handleCopyText,
  onPublish,
  onLeave,
}: Props) {
  const { t } = useTranslation();
  const router = useRouter();

  return (
    <CustomMenu
      customButton={<MoreHorizontal className="size-4 text-placeholder" aria-hidden="true" />}
      className={cn(
        "pointer-events-none flex-shrink-0 opacity-0 group-hover/project-item:pointer-events-auto group-hover/project-item:opacity-100",
        {
          "pointer-events-auto opacity-100": isMenuActive,
        }
      )}
      customButtonClassName="grid place-items-center"
      placement="bottom-start"
      ariaLabel={t("aria_labels.projects_sidebar.toggle_quick_actions_menu")}
      menuButtonOnClick={() => setIsMenuActive(!isMenuActive)}
      useCaptureForOutsideClick
      closeOnSelect
      onMenuClose={() => setIsMenuActive(false)}
    >
      {/* TODO: Removed is_favorite logic due to the optimization in projects API */}
      {/* publish project settings */}
      {isAdmin && (
        <CustomMenu.MenuItem onClick={onPublish}>
          <div className="relative flex flex-shrink-0 items-center justify-start gap-2">
            <div className="flex h-4 w-4 cursor-pointer items-center justify-center rounded-sm text-secondary transition-colors duration-300 hover:bg-layer-1">
              <Share2 className="h-3.5 w-3.5 stroke-[1.5]" />
            </div>
            <div>{t("publish_project")}</div>
          </div>
        </CustomMenu.MenuItem>
      )}
      <CustomMenu.MenuItem onClick={handleCopyText}>
        <span className="flex items-center justify-start gap-2">
          <LinkIcon className="h-3.5 w-3.5 stroke-[1.5]" />
          <span>{t("copy_link")}</span>
        </span>
      </CustomMenu.MenuItem>
      {isAuthorized && (
        <CustomMenu.MenuItem
          onClick={() => {
            router.push(`/${workspaceSlug}/projects/${projectId}/archives/issues`);
          }}
        >
          <div className="flex cursor-pointer items-center justify-start gap-2">
            <ArchiveIcon className="h-3.5 w-3.5 stroke-[1.5]" />
            <span>{t("archives")}</span>
          </div>
        </CustomMenu.MenuItem>
      )}
      <CustomMenu.MenuItem
        onClick={() => {
          router.push(`/${workspaceSlug}/settings/projects/${projectId}`);
        }}
      >
        <div className="flex cursor-pointer items-center justify-start gap-2">
          <Settings className="h-3.5 w-3.5 stroke-[1.5]" />
          <span>{t("settings")}</span>
        </div>
      </CustomMenu.MenuItem>
      {/* leave project */}
      {!isAuthorized && (
        <CustomMenu.MenuItem onClick={onLeave} data-ph-element={MEMBER_TRACKER_ELEMENTS.SIDEBAR_PROJECT_QUICK_ACTIONS}>
          <div className="flex items-center justify-start gap-2">
            <LogOut className="h-3.5 w-3.5 stroke-[1.5]" />
            <span>{t("leave_project")}</span>
          </div>
        </CustomMenu.MenuItem>
      )}
    </CustomMenu>
  );
}
