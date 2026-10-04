/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { ArchiveRestore } from "lucide-react";
import type { FunctionArgs, FunctionReturnType } from "convex/server";
import type { api } from "@summon/convex/api";
import { PROJECT_AUTOMATION_MONTHS } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
import { CustomSelect, ToggleSwitch } from "@plane/ui";
import { SettingsControlItem } from "@/components/settings/control-item";

export function AutoArchiveAutomation({
  settings,
  pending,
  handleChange,
  onCustomize,
}: {
  settings: FunctionReturnType<typeof api.projects.inactivity.get>;
  pending: boolean;
  handleChange: (changes: FunctionArgs<typeof api.projects.inactivity.save>["changes"]) => Promise<boolean>;
  onCustomize: () => void;
}) {
  const { t } = useTranslation();
  const enabled = settings.archiveMonths !== 0;
  const disabled = pending || !settings.canConfigure;
  return (
    <div className="flex flex-col gap-4 border-b border-subtle py-2">
      <div className="flex items-center gap-3">
        <div className="grid size-10 shrink-0 place-items-center rounded-sm bg-layer-2">
          <ArchiveRestore className="size-4 shrink-0 text-primary" />
        </div>
        <SettingsControlItem
          title={t("project_settings.automations.auto-archive.title")}
          description={t("project_settings.automations.auto-archive.description")}
          control={
            <ToggleSwitch
              label={t("project_settings.automations.auto-archive.title")}
              value={enabled}
              onChange={() => void handleChange({ archiveMonths: enabled ? 0 : 1 })}
              size="sm"
              disabled={disabled}
            />
          }
        />
      </div>
      {enabled && (
        <div className="ml-0 sm:ml-13">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-sm border border-subtle bg-surface-2 px-5 py-4">
            <div className="text-13 font-medium">{t("project_settings.automations.auto-archive.duration")}</div>
            <CustomSelect<number | "custom">
              ariaLabel="Archive after inactivity"
              value={settings.archiveMonths}
              label={`${settings.archiveMonths} ${settings.archiveMonths === 1 ? "month" : "months"}`}
              onChange={(value) => {
                if (value === "custom") return onCustomize();
                const months = settings.months.find((month) => month === value);
                if (months) void handleChange({ archiveMonths: months });
              }}
              input
              disabled={disabled}
            >
              {PROJECT_AUTOMATION_MONTHS.map((month) => (
                <CustomSelect.Option key={month.value} value={month.value}>
                  {t(month.i18n_label, { months: month.value })}
                </CustomSelect.Option>
              ))}
              <CustomSelect.Option value="custom">{t("common.customize_time_range")}</CustomSelect.Option>
            </CustomSelect>
          </div>
        </div>
      )}
    </div>
  );
}
