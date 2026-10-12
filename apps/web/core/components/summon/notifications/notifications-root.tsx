/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import React, { useState, useMemo } from "react";
import { observer } from "mobx-react";
import useSWR from "swr";
import Link from "next/link";
import { Bell, Inbox, Clock, ExternalLink, MessageSquare } from "lucide-react";
import { useWorkspaceNotifications } from "@/hooks/store/notifications";
import { useWorkspace } from "@/hooks/store/use-workspace";
import { getButtonStyling } from "@plane/propel/button";
import { SummonRequestState } from "@/components/summon/request-state";
import { SummonMetric, SummonMetricStrip, SummonPageHeader, summonPageClassName } from "@/components/summon/screen";

interface INotificationsRootProps {
  workspaceSlug: string;
}

export const NotificationsRoot = observer(function NotificationsRoot({ workspaceSlug }: INotificationsRootProps) {
  const { getNotifications, loader, notificationIdsByWorkspaceId, notifications } = useWorkspaceNotifications();
  const { currentWorkspace } = useWorkspace();

  const { error, isLoading, mutate } = useSWR(["summon-notifications", workspaceSlug], () =>
    getNotifications(workspaceSlug)
  );

  const [filterTab, setFilterTab] = useState<"all" | "unread" | "mentions">("all");

  const rawRecords = useMemo(
    () =>
      (currentWorkspace ? notificationIdsByWorkspaceId(currentWorkspace.id) : [])?.map((id) => notifications[id]) ?? [],
    [currentWorkspace, notificationIdsByWorkspaceId, notifications]
  );

  const filteredRecords = useMemo(() => {
    if (filterTab === "unread") {
      return rawRecords.filter((r) => !r.read_at);
    }
    return rawRecords;
  }, [rawRecords, filterTab]);

  const unreadCount = rawRecords.filter((r) => !r.read_at).length;

  return (
    <div className={summonPageClassName}>
      <SummonPageHeader
        title="Notifications"
        description="Updates on tasks, mentions and pipeline activity"
        actions={
          <Link href={`/${workspaceSlug}/notifications/`} className={getButtonStyling("secondary", "lg")}>
            <Inbox />
            Open inbox
          </Link>
        }
      />

      <SummonMetricStrip>
        <SummonMetric label="Updates" value={rawRecords.length} />
        <SummonMetric label="Unread" value={unreadCount} />
      </SummonMetricStrip>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-subtle pb-3">
        <button
          type="button"
          onClick={() => setFilterTab("all")}
          className={`rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all ${
            filterTab === "all"
              ? "bg-accent-primary text-white shadow-xs"
              : "border border-subtle bg-surface-1 text-secondary hover:bg-layer-1 hover:text-primary"
          }`}
        >
          All ({rawRecords.length})
        </button>
        <button
          type="button"
          onClick={() => setFilterTab("unread")}
          className={`rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all ${
            filterTab === "unread"
              ? "bg-accent-primary text-white shadow-xs"
              : "border border-subtle bg-surface-1 text-secondary hover:bg-layer-1 hover:text-primary"
          }`}
        >
          Unread ({unreadCount})
        </button>
      </div>

      <SummonRequestState
        loading={isLoading || !!loader}
        error={error}
        empty={!isLoading && !loader && filteredRecords.length === 0}
        emptyIcon={Bell}
        emptyTitle="You're all caught up"
        emptyMessage="New mentions and updates will appear here."
        onRetry={() => void mutate()}
      />

      {/* Notifications List */}
      <div className="space-y-3">
        {filteredRecords.map((notification) => {
          const isUnread = !notification.read_at;

          return (
            <Link
              key={notification.id}
              href={`/${workspaceSlug}/notifications/`}
              className={`group hover:border-accent-primary/40 flex items-start justify-between gap-4 rounded-2xl border p-4 transition-all hover:shadow-sm ${
                isUnread
                  ? "border-accent-primary/40 ring-accent-primary/20 bg-surface-1 shadow-xs ring-1"
                  : "border-subtle bg-surface-1"
              }`}
            >
              <div className="flex min-w-0 items-start gap-3.5">
                <div
                  className={`flex size-9 shrink-0 items-center justify-center rounded-xl ${
                    isUnread ? "bg-accent-primary/10 text-accent-primary" : "bg-layer-2 text-secondary"
                  }`}
                >
                  <MessageSquare className="size-4.5" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="truncate text-xs font-bold text-primary group-hover:text-accent-primary">
                      {notification.title || notification.entity_name || "Workspace Update"}
                    </h3>
                    {isUnread && (
                      <span className="rounded-full bg-accent-primary px-2 py-0.5 text-12 font-bold text-white">
                        New
                      </span>
                    )}
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs text-secondary">
                    {notification.data?.issue?.name ?? notification.message_html ?? "View details in your inbox."}
                  </p>
                  <div className="mt-2 flex items-center gap-1.5 text-12 text-tertiary">
                    <Clock className="size-3" />
                    <span>{notification.created_at?.slice(0, 10) || "Recent"}</span>
                  </div>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-1 text-12 font-semibold text-accent-primary group-hover:underline">
                <span>View in Inbox</span>
                <ExternalLink className="size-3" />
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
});
