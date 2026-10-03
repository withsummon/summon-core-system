/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import { useMutation } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "@summon/convex/api";
import { useTranslation } from "@plane/i18n";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import { ToggleSwitch } from "@plane/ui";
import { mutationMessage } from "@/components/convex-core/commercial/forms";
import { SettingsControlItem } from "@/components/settings/control-item";

type Preferences = FunctionReturnType<typeof api.notifications.index.preferences>;

export function NotificationsProfileSettingsForm({ data }: { data: Preferences }) {
  const { t } = useTranslation();
  const save = useMutation(api.notifications.index.savePreferences);
  const [pending, setPending] = useState(false);

  const handleSettingChange = async (key: keyof Preferences["settings"], value: boolean) => {
    setPending(true);
    try {
      await save({ expectedRevision: data.revision, settings: { ...data.settings, [key]: value } });
      setToast({
        title: t("success"),
        type: TOAST_TYPE.SUCCESS,
        message: t("email_notification_setting_updated_successfully"),
      });
    } catch (error) {
      setToast({ title: t("error"), type: TOAST_TYPE.ERROR, message: mutationMessage(error) });
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="flex flex-col gap-y-1">
      <SettingsControlItem
        title={t("property_changes")}
        description={t("property_changes_description")}
        control={
          <ToggleSwitch
            value={data.settings.propertyChange}
            label={t("property_changes")}
            onChange={(value) => void handleSettingChange("propertyChange", value)}
            disabled={pending}
            size="sm"
          />
        }
      />
      <SettingsControlItem
        title={t("state_change")}
        description={t("state_change_description")}
        control={
          <ToggleSwitch
            value={data.settings.stateChange}
            label={t("state_change")}
            onChange={(value) => void handleSettingChange("stateChange", value)}
            disabled={pending}
            size="sm"
          />
        }
      />
      <div className="border-l-3 border-subtle-1 pl-3">
        <SettingsControlItem
          title={t("issue_completed")}
          description={t("issue_completed_description")}
          control={
            <ToggleSwitch
              value={data.settings.issueCompleted}
              label={t("issue_completed")}
              onChange={(value) => void handleSettingChange("issueCompleted", value)}
              disabled={pending}
              size="sm"
            />
          }
        />
      </div>
      <SettingsControlItem
        title={t("comments")}
        description={t("comments_description")}
        control={
          <ToggleSwitch
            value={data.settings.comment}
            label={t("comments")}
            onChange={(value) => void handleSettingChange("comment", value)}
            disabled={pending}
            size="sm"
          />
        }
      />
      <SettingsControlItem
        title={t("mentions")}
        description={t("mentions_description")}
        control={
          <ToggleSwitch
            value={data.settings.mention}
            label={t("mentions")}
            onChange={(value) => void handleSettingChange("mention", value)}
            disabled={pending}
            size="sm"
          />
        }
      />
    </div>
  );
}
