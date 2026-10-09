/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useEffect } from "react";
import { usePaginatedQuery } from "convex-helpers/react";
import { api } from "@summon/convex/api";
import type { Id } from "@summon/convex/data-model";
import { useTranslation } from "@plane/i18n";
import { Avatar } from "@plane/propel/avatar";
import { EmptyStateCompact } from "@plane/propel/empty-state";
import { Loader, Card } from "@plane/ui";
import { calculateTimeAgo } from "@plane/utils";
import { AuthenticatedAssetImage } from "@/components/convex-core/assets/image";
import { ProfileActivityMessage } from "@/components/convex-core/tasks/activity/activity";
import { ActivityChanges } from "@/components/convex-core/tasks/activity/changes";

export function ProfileActivity({
  workspaceId,
  userId,
  currentUserId,
}: {
  workspaceId: Id<"workspaces">;
  userId: Id<"users">;
  currentUserId: Id<"users">;
}) {
  const { t } = useTranslation();
  const rows = usePaginatedQuery(api.tasks.activity.profile, { workspaceId, userId }, { initialNumItems: 10 });
  const { status, loadMore } = rows;
  const loadedCount = rows.results.length;
  useEffect(() => {
    if (status === "CanLoadMore" && loadedCount < 10) loadMore(10);
  }, [status, loadMore, loadedCount]);

  return (
    <div className="space-y-2">
      <h3 className="text-16 font-medium">{t("profile.stats.recent_activity.title")}</h3>
      <Card>
        {status === "LoadingFirstPage" || (loadedCount === 0 && status !== "Exhausted") ? (
          <Loader className="space-y-5">
            <Loader.Item height="40px" />
            <Loader.Item height="40px" />
            <Loader.Item height="40px" />
            <Loader.Item height="40px" />
            <Loader.Item height="40px" />
          </Loader>
        ) : loadedCount > 0 ? (
          <div className="space-y-5">
            {rows.results.slice(0, 10).map((event) => (
              <div key={event.id} className="flex gap-3">
                {event.avatar ? (
                  <AuthenticatedAssetImage
                    asset={event.avatar}
                    alt="Member avatar"
                    compactName={event.actorName ?? "Member"}
                    className="font-normal size-6 rounded-sm border-0 object-cover text-13"
                  />
                ) : (
                  <Avatar name={event.actorName ?? "Member"} size="base" shape="square" />
                )}
                <div className="-mt-1 w-4/5 break-words">
                  <p className="text-13 text-secondary">
                    <span className="font-medium text-primary">
                      {event.automation
                        ? "Automation"
                        : currentUserId === event.actorId
                          ? "You"
                          : (event.actorName ?? "Member")}{" "}
                    </span>
                    <ProfileActivityMessage event={event} />
                  </p>
                  {event.changes && <ActivityChanges changes={event.changes} />}
                  <p className="text-11 whitespace-nowrap text-secondary">
                    {calculateTimeAgo(new Date(event.at).toISOString())}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyStateCompact title={t("no_data_yet")} assetKey="unknown" assetClassName="size-20" />
        )}
      </Card>
    </div>
  );
}
