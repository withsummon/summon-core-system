/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useQuery } from "convex/react";
import { api } from "@summon/convex/api";
import { useTranslation } from "@plane/i18n";
import { ProfileSettingsHeading } from "@/components/settings/profile/heading";
import { EmailSettingsLoader } from "@/components/ui/loader/settings/email";
import { NotificationsProfileSettingsForm } from "./email-notification-form";

export function NotificationsProfileSettings() {
  const { t } = useTranslation();
  const data = useQuery(api.notifications.index.preferences, {});

  if (!data) return <EmailSettingsLoader />;

  return (
    <div className="size-full">
      <ProfileSettingsHeading
        title={t("account_settings.notifications.heading")}
        description={t("account_settings.notifications.description")}
      />
      <div className="mt-7">
        <NotificationsProfileSettingsForm data={data} />
      </div>
    </div>
  );
}
