/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useOutletContext } from "react-router";
import { usePaginatedQuery } from "convex-helpers/react";
import { api } from "@summon/convex/api";
import { useTranslation } from "@plane/i18n";
import { Button } from "@plane/propel/button";
import { PageHead } from "@/components/core/page-title";
import { ActivityList } from "@/components/profile/activity/activity-list";
import { DownloadActivityButton } from "@/components/profile/activity/download-button";
import { ActivitySettingsLoader } from "@/components/ui/loader/settings/activity";
import type { ProfileSession } from "../layout";

export default function ProfileActivityPage() {
  const { user, workspace, subject } = useOutletContext<ProfileSession>();
  const { t } = useTranslation();
  const rows = usePaginatedQuery(
    api.tasks.activity.profile,
    { workspaceId: workspace._id, userId: subject.userId },
    { initialNumItems: 100 }
  );
  return (
    <>
      <PageHead title="Profile - Activity" />
      <div className="flex h-full w-full flex-col overflow-hidden py-5">
        <div className="flex items-center justify-between gap-2 px-5 md:px-9">
          <h3 className="text-16 font-medium">{t("profile.stats.recent_activity.title")}</h3>
          {subject.canExportActivity && <DownloadActivityButton workspaceId={workspace._id} userId={subject.userId} />}
        </div>
        <div className="vertical-scrollbar flex scrollbar-md h-full flex-col overflow-y-auto px-5 md:px-9">
          {rows.status === "LoadingFirstPage" ? (
            <ActivitySettingsLoader />
          ) : (
            <ActivityList activity={rows.results} currentUserId={user.id} />
          )}
          {rows.status === "Exhausted" && rows.results.length === 0 && (
            <p className="py-5 text-secondary">{t("no_data_yet")}</p>
          )}
          {rows.status !== "LoadingFirstPage" && rows.status !== "Exhausted" && (
            <div className="flex w-full items-center justify-center text-11">
              <Button variant="secondary" loading={rows.status === "LoadingMore"} onClick={() => rows.loadMore(100)}>
                {t("common.load_more")}
              </Button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
