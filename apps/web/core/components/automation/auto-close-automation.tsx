/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { ComponentProps } from "react";
import { ArchiveX } from "lucide-react";
import { PROJECT_AUTOMATION_MONTHS, EIconSize } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
import { StateGroupIcon, StatePropertyIcon } from "@plane/propel/icons";
import { CustomSelect, CustomSearchSelect, ToggleSwitch } from "@plane/ui";
import { SettingsControlItem } from "@/components/settings/control-item";
import type { AutoArchiveAutomation } from "./auto-archive-automation";

export function AutoCloseAutomation({
  settings,
  pending,
  handleChange,
  onCustomize,
}: ComponentProps<typeof AutoArchiveAutomation>) {
  const { t } = useTranslation();
  const close = settings.close;
  const disabled = pending || !settings.canConfigure;
  const firstState = settings.cancelledStates[0];
  const selected = settings.cancelledStates.find((state) => state._id === close?.stateId);
  const options = settings.cancelledStates.map((state) => ({
    value: state._id,
    query: state.name,
    content: (
      <div className="flex items-center gap-2">
        <StateGroupIcon stateGroup="cancelled" color={state.color} size={EIconSize.LG} />
        {state.name}
      </div>
    ),
  }));
  return (
    <div className="flex flex-col gap-4 py-2">
      <div className="flex items-center gap-3">
        <div className="grid size-10 shrink-0 place-items-center rounded-sm bg-layer-2">
          <ArchiveX className="size-4 shrink-0 text-danger-primary" />
        </div>
        <SettingsControlItem
          title={t("project_settings.automations.auto-close.title")}
          description={t("project_settings.automations.auto-close.description")}
          control={
            <ToggleSwitch
              label={t("project_settings.automations.auto-close.title")}
              value={close !== null}
              onChange={() => {
                if (close) void handleChange({ close: null });
                else if (firstState) void handleChange({ close: { months: 1, stateId: firstState._id } });
              }}
              size="sm"
              disabled={disabled || !firstState}
            />
          }
        />
      </div>
      {close && (
        <div className="ml-0 sm:ml-13">
          <div className="flex flex-col rounded-sm border border-subtle bg-surface-2">
            <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-4">
              <div className="text-13 font-medium">{t("project_settings.automations.auto-close.duration")}</div>
              <CustomSelect<number | "custom">
                ariaLabel="Close after inactivity"
                value={close.months}
                label={`${close.months} ${close.months === 1 ? "month" : "months"}`}
                onChange={(value) => {
                  if (value === "custom") return onCustomize();
                  const months = settings.months.find((month) => month === value);
                  if (months) void handleChange({ close: { ...close, months } });
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
            <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-4">
              <div className="text-13 font-medium">
                {t("project_settings.automations.auto-close.auto_close_status")}
              </div>
              <CustomSearchSelect
                ariaLabel="Automatic cancellation state"
                value={close.stateId}
                label={
                  <div className="flex items-center gap-2">
                    {selected ? (
                      <>
                        <StateGroupIcon stateGroup="cancelled" color={selected.color} size={EIconSize.LG} />
                        {selected.name}
                      </>
                    ) : (
                      <StatePropertyIcon className="size-3.5 text-secondary" />
                    )}
                  </div>
                }
                onChange={(value: string) => {
                  const state = settings.cancelledStates.find((row) => row._id === value);
                  if (state) void handleChange({ close: { ...close, stateId: state._id } });
                }}
                options={options}
                disabled={disabled || settings.cancelledStates.length < 2}
                input
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
