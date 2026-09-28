/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { X } from "lucide-react";
// plane imports
import { IconButton } from "@plane/propel/icon-button";
import { Dialog } from "@plane/propel/dialog";
import { EModalPosition, EModalWidth, ModalCore } from "@plane/ui";
import type { TProfileSettingsTabs } from "@plane/types";
// local imports
import { ProfileSettingsContent } from "./content";
import { ProfileSettingsSidebarRoot } from "./sidebar";

export function ProfileSettingsModal({
  isOpen,
  activeTab,
  onTabChange,
  onClose,
}: {
  isOpen: boolean;
  activeTab: TProfileSettingsTabs;
  onTabChange: (tab: TProfileSettingsTabs) => void;
  onClose: () => void;
}) {
  return (
    <ModalCore
      isOpen={isOpen}
      handleClose={onClose}
      position={EModalPosition.CENTER}
      width={EModalWidth.VIXL}
      className="h-175"
    >
      <Dialog.Title className="sr-only">Account settings</Dialog.Title>
      <div className="@container relative size-full">
        <div className="flex size-full flex-col md:flex-row">
          <ProfileSettingsSidebarRoot
            activeTab={activeTab}
            className="w-[250px] rounded-l-xl"
            updateActiveTab={onTabChange}
          />
          <ProfileSettingsContent activeTab={activeTab} className="flex-1 rounded-r-xl" />
        </div>
        <div className="absolute top-3.5 right-3.5">
          <IconButton size="base" variant="tertiary" icon={X} onClick={onClose} aria-label="Close account settings" />
        </div>
      </div>
    </ModalCore>
  );
}
