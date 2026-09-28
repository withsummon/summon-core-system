/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import { useMutation } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "@summon/convex/api";
import { SUPPORTED_LANGUAGES, useTranslation } from "@plane/i18n";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import { CustomSelect } from "@plane/ui";
import { mutationMessage } from "@/components/convex-core/commercial/forms";
import { TimezoneSelect } from "@/components/global";
import { StartOfWeekPreference } from "@/components/profile/start-of-week-preference";
import { SettingsControlItem } from "@/components/settings/control-item";

export function ProfileSettingsLanguageAndTimezonePreferencesList({
  profile,
}: {
  profile: FunctionReturnType<typeof api.identity.profile.get>;
}) {
  const saveProfile = useMutation(api.identity.profile.save);
  const savePreferences = useMutation(api.identity.preferences.save);
  const [pending, setPending] = useState(false);
  const { t } = useTranslation();

  const handleTimezoneChange = async (timezone: string) => {
    setPending(true);
    try {
      await saveProfile({
        expectedRevision: profile.revision,
        firstName: profile.firstName,
        lastName: profile.lastName,
        displayName: profile.displayName,
        timezone,
      });
      setToast({ title: "Success!", message: "Timezone updated successfully", type: TOAST_TYPE.SUCCESS });
    } catch (error) {
      setToast({ title: "Error!", message: mutationMessage(error), type: TOAST_TYPE.ERROR });
    } finally {
      setPending(false);
    }
  };

  const handleLanguageChange = async (language: typeof profile.preferences.language) => {
    setPending(true);
    try {
      await savePreferences({
        expectedRevision: profile.revision,
        preferences: { ...profile.preferences, language },
      });
      setToast({ title: "Success!", message: "Language updated successfully", type: TOAST_TYPE.SUCCESS });
    } catch (error) {
      setToast({ title: "Error!", message: mutationMessage(error), type: TOAST_TYPE.ERROR });
    } finally {
      setPending(false);
    }
  };

  return (
    <fieldset disabled={pending} className="flex flex-col gap-y-1">
      <SettingsControlItem
        title={t("timezone")}
        description={t("timezone_setting")}
        control={<TimezoneSelect value={profile.timezone} onChange={handleTimezoneChange} />}
      />
      <SettingsControlItem
        title={t("language")}
        description={t("language_setting")}
        control={
          <CustomSelect
            value={profile.preferences.language}
            label={SUPPORTED_LANGUAGES.find((language) => language.value === profile.preferences.language)?.label}
            onChange={handleLanguageChange}
            buttonClassName="border border-subtle-1"
            className="rounded-md"
            input
            placement="bottom-end"
          >
            {SUPPORTED_LANGUAGES.map((item) => (
              <CustomSelect.Option key={item.value} value={item.value}>
                {item.label}
              </CustomSelect.Option>
            ))}
          </CustomSelect>
        }
      />
      <StartOfWeekPreference
        profile={profile}
        option={{
          title: "First day of the week",
          description: "This will change how all calendars in your app look.",
        }}
      />
    </fieldset>
  );
}
