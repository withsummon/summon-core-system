/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */
import { useOutletContext } from "react-router";
import { useTranslation } from "@plane/i18n";
import { ContentWrapper } from "@plane/ui";
import { PageHead } from "@/components/core/page-title";
import { ProfileActivity } from "@/components/profile/overview/activity";
import { ProfilePriorityDistribution } from "@/components/profile/overview/priority-distribution";
import { ProfileStateDistribution } from "@/components/profile/overview/state-distribution";
import { ProfileStats } from "@/components/profile/overview/stats";
import { ProfileWorkload } from "@/components/profile/overview/workload";
import type { ProfileSession } from "./layout";

export default function ProfileOverviewPage() {
  const { user, workspace, subject, summary } = useOutletContext<ProfileSession>();
  const { t } = useTranslation();
  return (
    <>
      <PageHead title={t("profile.page_label")} />
      <ContentWrapper className="space-y-7">
        <ProfileStats workspaceSlug={workspace.slug} subject={subject} summary={summary} />
        <ProfileWorkload summary={summary} />
        <div className="grid grid-cols-1 items-stretch gap-5 xl:grid-cols-2">
          <ProfilePriorityDistribution summary={summary} />
          <ProfileStateDistribution summary={summary} />
        </div>
        <ProfileActivity workspaceId={workspace._id} userId={subject.userId} currentUserId={user.id} />
      </ContentWrapper>
    </>
  );
}
