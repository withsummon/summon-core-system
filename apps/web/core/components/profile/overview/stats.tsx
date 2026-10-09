/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import Link from "next/link";
import type { UsePaginatedQueryResult } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import type { api } from "@summon/convex/api";
import { useTranslation } from "@plane/i18n";
import { UserCirclePropertyIcon, CreateIcon, LayerStackIcon } from "@plane/propel/icons";
import { Loader, Card, ECardSpacing, ECardDirection } from "@plane/ui";

export type ProfileSummary = UsePaginatedQueryResult<
  FunctionReturnType<typeof api.tasks.profile.summary>["page"][number]
>;

const overviewCards = [
  { icon: CreateIcon, route: "created", i18nTitle: "profile.stats.created", count: "createdCount" },
  { icon: UserCirclePropertyIcon, route: "assigned", i18nTitle: "profile.stats.assigned", count: "assignedCount" },
  { icon: LayerStackIcon, route: "subscribed", i18nTitle: "profile.stats.subscribed", count: "subscribedCount" },
] as const;

export function ProfileStats({
  workspaceSlug,
  subject,
  summary,
}: {
  workspaceSlug: string;
  subject: FunctionReturnType<typeof api.tasks.profile.subject>;
  summary: ProfileSummary;
}) {
  const { t } = useTranslation();
  return (
    <div className="space-y-2">
      <h3 className="text-16 font-medium">{t("profile.stats.overview")}</h3>
      {summary.status === "Exhausted" ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {overviewCards.map((card) => {
            const content = (
              <Card key={card.route} direction={ECardDirection.ROW} spacing={ECardSpacing.SM} className="h-full">
                <div className="grid h-11 w-11 place-items-center rounded-sm bg-surface-2">
                  <card.icon className="h-5 w-5" />
                </div>
                <div className="space-y-1">
                  <p className="text-13 text-placeholder">{t(card.i18nTitle)}</p>
                  <p className="text-18 font-semibold">
                    {summary.results.reduce((total, project) => total + project[card.count], 0)}
                  </p>
                </div>
              </Card>
            );
            return subject.canViewTaskTabs ? (
              <Link key={card.route} href={`/${workspaceSlug}/profile/${subject.userId}/${card.route}`}>
                {content}
              </Link>
            ) : (
              content
            );
          })}
        </div>
      ) : (
        <Loader className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          <span className="sr-only">{t("loading")}</span>
          {overviewCards.map((card) => (
            <Loader.Item key={card.route} height="80px" />
          ))}
        </Loader>
      )}
    </div>
  );
}
