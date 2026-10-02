/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { FunctionArgs } from "convex/server";
import type { api } from "@summon/convex/api";
import { profileViewSchema } from "@summon/convex/task-schema";
// components
import { PageHead } from "@/components/core/page-title";
import { ProfileIssuesPage } from "@/components/profile/profile-issues";
import type { Route } from "./+types/page";

const ProfilePageHeader = {
  assigned: "Profile - Assigned",
  created: "Profile - Created",
  subscribed: "Profile - Subscribed",
} satisfies Record<FunctionArgs<typeof api.tasks.profile.list>["view"], string>;

function ProfileIssuesTypePage({ params }: Route.ComponentProps) {
  const parsed = profileViewSchema.safeParse(params.profileViewId);
  if (!parsed.success)
    return (
      <p role="alert" className="p-6">
        Profile view not found.
      </p>
    );
  const profileViewId = parsed.data;

  const header = ProfilePageHeader[profileViewId];

  return (
    <>
      <PageHead title={header} />
      <ProfileIssuesPage type={profileViewId} />
    </>
  );
}

export default ProfileIssuesTypePage;
