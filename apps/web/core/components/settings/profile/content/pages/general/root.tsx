/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useQuery } from "convex/react";
import { api } from "@summon/convex/api";
import { useTranslation } from "@plane/i18n";
// components
import { PageHead } from "@/components/core/page-title";
// hooks
// local imports
import { GeneralProfileSettingsForm } from "./form";

export function GeneralProfileSettings() {
  const { t } = useTranslation();
  // store hooks
  const profile = useQuery(api.identity.profile.get);

  if (!profile) return <p role="status">Loading profile…</p>;

  return (
    <>
      <PageHead title={`${t("profile.label")} - ${t("general_settings")}`} />
      <GeneralProfileSettingsForm key={profile.id} profile={profile} />
    </>
  );
}
