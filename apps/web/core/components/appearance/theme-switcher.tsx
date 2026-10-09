/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import { useMutation } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "@summon/convex/api";
import { THEME_OPTIONS } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import { mutationMessage } from "@/components/convex-core/commercial/forms";
import { CustomThemeSelector } from "@/components/core/theme/custom-theme-selector";
import { ThemeSwitch } from "@/components/core/theme/theme-switch";
import { SettingsControlItem } from "@/components/settings/control-item";

type Profile = FunctionReturnType<typeof api.identity.profile.get>;

export function ThemeSwitcher({
  option,
  profile,
}: {
  option: { title: string; description: string };
  profile: Profile;
}) {
  const save = useMutation(api.identity.preferences.save);
  const [pending, setPending] = useState(false);
  const { t } = useTranslation();
  const currentTheme =
    THEME_OPTIONS.find((themeOption) => themeOption.value === profile.preferences.theme.theme) ?? null;

  const saveTheme = (theme: Profile["preferences"]["theme"], expectedRevision: number) =>
    save({ expectedRevision, preferences: { ...profile.preferences, theme } });

  const handleThemeChange = async (themeOption: (typeof THEME_OPTIONS)[number]) => {
    setPending(true);
    try {
      await saveTheme({ ...profile.preferences.theme, theme: themeOption.value }, profile.revision);
      setToast({ type: TOAST_TYPE.SUCCESS, title: "Theme updated", message: "Appearance updated successfully" });
    } catch (error) {
      setToast({ type: TOAST_TYPE.ERROR, title: "Error!", message: mutationMessage(error) });
    } finally {
      setPending(false);
    }
  };

  return (
    <>
      <SettingsControlItem
        title={t(option.title)}
        description={t(option.description)}
        control={
          <fieldset disabled={pending}>
            <ThemeSwitch
              ariaLabel={t(option.title)}
              value={currentTheme}
              onChange={(themeOption) => void handleThemeChange(themeOption)}
            />
          </fieldset>
        }
      />
      {profile.preferences.theme.theme === "custom" && (
        <CustomThemeSelector theme={profile.preferences.theme} revision={profile.revision} onSave={saveTheme} />
      )}
    </>
  );
}
