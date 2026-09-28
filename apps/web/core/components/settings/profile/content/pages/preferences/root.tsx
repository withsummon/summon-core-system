/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useQuery } from "convex/react";
import { api } from "@summon/convex/api";
import { useTranslation } from "@plane/i18n";
import { ProfileSettingsHeading } from "@/components/settings/profile/heading";
import { ThemeSwitcher } from "@/components/appearance";
import { ProfileSettingsLanguageAndTimezonePreferencesList } from "./language-and-timezone-list";

export function PreferencesProfileSettings() {
  const { t } = useTranslation();
  const profile = useQuery(api.identity.profile.get, {});

  if (!profile) return <p role="status">Loading preferences…</p>;

  return (
    <div className="size-full">
      <ProfileSettingsHeading
        title={t("account_settings.preferences.heading")}
        description={t("account_settings.preferences.description")}
      />
      <div className="mt-7 flex w-full flex-col gap-6">
        <section>
          <div className="flex flex-col gap-y-1">
            <ThemeSwitcher
              profile={profile}
              option={{
                title: "theme",
                description: "select_or_customize_your_interface_color_scheme",
              }}
            />
          </div>
        </section>
        <section className="flex flex-col gap-y-3">
          <div className="text-h6-medium text-primary">{t("language_and_time")}</div>
          <ProfileSettingsLanguageAndTimezonePreferencesList profile={profile} />
        </section>
      </div>
    </div>
  );
}
