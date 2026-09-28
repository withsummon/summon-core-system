/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

// plane imports
import { useState } from "react";
import { Menu } from "lucide-react";
import { PROFILE_SETTINGS } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
import { Popover } from "@plane/propel/popover";
import { ScrollArea } from "@plane/propel/scrollarea";
import type { TProfileSettingsTabs } from "@plane/types";
import { cn } from "@plane/utils";
// local imports
import { ProfileSettingsSidebarHeader } from "./header";
import { ProfileSettingsSidebarItemCategories } from "./item-categories";

type Props = {
  activeTab: TProfileSettingsTabs;
  className?: string;
  updateActiveTab: (tab: TProfileSettingsTabs) => void;
};

export function ProfileSettingsSidebarRoot(props: Props) {
  const { activeTab, className, updateActiveTab } = props;
  const [open, setOpen] = useState(false);
  const { t } = useTranslation();

  return (
    <>
      <ScrollArea
        scrollType="hover"
        orientation="vertical"
        size="sm"
        rootClassName={cn(
          "hidden shrink-0 overflow-y-scroll border-r border-r-subtle bg-surface-2 px-3 py-4 md:block",
          className
        )}
      >
        <ProfileSettingsSidebarHeader />
        <ProfileSettingsSidebarItemCategories activeTab={activeTab} updateActiveTab={updateActiveTab} />
      </ScrollArea>
      <div className="shrink-0 border-b border-subtle bg-surface-2 px-3 py-3 md:hidden">
        <Popover open={open} onOpenChange={setOpen}>
          <Popover.Button
            aria-label="Account settings sections"
            className="flex items-center gap-3 rounded-md border border-subtle px-3 py-2 text-13 text-secondary"
          >
            <Menu className="size-4" />
            {t(PROFILE_SETTINGS[activeTab].i18n_label)}
          </Popover.Button>
          <Popover.Panel
            aria-label="Account settings sections"
            align="start"
            positionerClassName="z-110 md:hidden"
            className="shadow-lg max-h-[min(25rem,var(--available-height))] w-[250px] overflow-y-auto rounded-lg border border-subtle bg-surface-2 px-3 py-4"
          >
            <ProfileSettingsSidebarItemCategories
              activeTab={activeTab}
              updateActiveTab={(tab) => {
                updateActiveTab(tab);
                setOpen(false);
              }}
            />
          </Popover.Panel>
        </Popover>
      </div>
    </>
  );
}
