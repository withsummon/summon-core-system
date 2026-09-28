/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { HelpCircle, User } from "lucide-react";
import { useTranslation } from "@plane/i18n";
import { PageIcon } from "@plane/propel/icons";
import { CustomMenu } from "@plane/ui";
import { PlaneVersionNumber } from "@/components/global/version-number";
export function HelpMenuView({ onShortcuts, onUpdates }: { onShortcuts: () => void; onUpdates: () => void }) {
  const { t } = useTranslation();
  return (
    <CustomMenu
      ariaLabel={t("power_k.group_titles.help")}
      customButton={
        <span className="grid size-8 place-items-center rounded-md text-tertiary hover:bg-layer-transparent-hover">
          <HelpCircle className="size-5" aria-hidden="true" />
        </span>
      }
      // customButtonClassName="relative grid place-items-center rounded-md p-1.5 outline-none"
      placement="bottom-end"
      maxHeight="lg"
      closeOnSelect
    >
      <CustomMenu.MenuItem onClick={() => window.open("https://go.plane.so/p-docs", "_blank")}>
        <div className="flex items-center gap-x-2 rounded-sm text-11">
          <PageIcon className="h-3.5 w-3.5 text-secondary" height={14} width={14} />
          <span className="text-11">{t("documentation")}</span>
        </div>
      </CustomMenu.MenuItem>
      <CustomMenu.MenuItem onClick={() => window.open("mailto:sales@plane.so", "_blank")}>
        <div className="flex items-center gap-x-2 rounded-sm text-11">
          <User className="h-3.5 w-3.5 text-secondary" size={14} />
          <span className="text-11">{t("contact_sales")}</span>
        </div>
      </CustomMenu.MenuItem>
      <div className="my-1 border-t border-subtle" />
      <CustomMenu.MenuItem onClick={onShortcuts}>
        <span className="text-11">{t("keyboard_shortcuts")}</span>
      </CustomMenu.MenuItem>
      <CustomMenu.MenuItem onClick={onUpdates}>
        <span className="text-11">{t("whats_new")}</span>
      </CustomMenu.MenuItem>
      <CustomMenu.MenuItem onClick={() => window.open("https://forum.plane.so", "_blank", "noopener,noreferrer")}>
        <div className="flex items-center gap-x-2 rounded-sm text-11">
          <span className="text-11">Forum</span>
        </div>
      </CustomMenu.MenuItem>
      <div className="mt-1 border-t border-subtle px-1 pt-2 text-11 text-secondary">
        <PlaneVersionNumber />
      </div>
    </CustomMenu>
  );
}
