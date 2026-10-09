/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useQuery } from "convex/react";
import { api } from "@summon/convex/api";
import { GeneralProfileSettingsForm } from "./form";

export function GeneralProfileSettings() {
  const profile = useQuery(api.identity.profile.get);

  if (!profile) return <p role="status">Loading profile…</p>;

  return <GeneralProfileSettingsForm key={profile.id} profile={profile} />;
}
