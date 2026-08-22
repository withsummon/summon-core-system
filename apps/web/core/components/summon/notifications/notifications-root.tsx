/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import React, { useState, useMemo } from "react";
import { observer } from "mobx-react";
import useSWR from "swr";
import Link from "next/link";
import { Bell, CheckCircle2, Inbox, Clock, Sparkles, ExternalLink, MessageSquare, AlertTriangle } from "lucide-react";
import { useWorkspaceNotifications } from "@/hooks/store/notifications";
import { useWorkspace } from "@/hooks/store/use-workspace";
import { SummonRequestState } from "@/components/summon/request-state";

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
    <div className="flex flex-col gap-6 p-6 lg:p-8">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-primary">Notifications & Activity Feed</h1>
          <p className="text-xs font-medium text-secondary">
            Stay updated on work item updates, pipeline mentions, and system events
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Link
            href={`/${workspaceSlug}/notifications/`}
            className="text-xs shadow-xs flex items-center gap-1.5 rounded-xl bg-accent-primary px-3.5 py-2 font-bold text-white hover:bg-accent-primary/90"
          >
            <Inbox className="size-3.5" />
            <span>Open Plane Inbox</span>
            <ExternalLink className="size-3" />
          </Link>
        </div>
      </div>

      {/* KPI Stat Row */}
      <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3">
        <div className="shadow-sm flex flex-col justify-between rounded-2xl border border-subtle bg-surface-1 p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-secondary">Total Updates</span>
            <div className="bg-blue-500/10 text-blue-600 flex size-8 items-center justify-center rounded-xl">
              <Bell className="size-4.5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold tracking-tight text-primary">{rawRecords.length}</div>
            <div className="mt-1 text-[11px] font-medium text-tertiary">All notifications</div>
          </div>
        </div>

        <div className="shadow-sm flex flex-col justify-between rounded-2xl border border-subtle bg-surface-1 p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-secondary">Unread</span>
            <div className="bg-amber-500/10 text-amber-600 flex size-8 items-center justify-center rounded-xl">
              <AlertTriangle className="size-4.5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl text-amber-600 dark:text-amber-400 font-bold tracking-tight">{unreadCount}</div>
            <div className="mt-1 text-[11px] font-medium text-tertiary">Require review</div>
          </div>
        </div>

        <div className="shadow-sm col-span-2 flex flex-col justify-between rounded-2xl border border-subtle bg-surface-1 p-4 sm:col-span-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-secondary">Feed Status</span>
            <div className="bg-emerald-500/10 text-emerald-600 flex size-8 items-center justify-center rounded-xl">
              <CheckCircle2 className="size-4.5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl text-emerald-600 dark:text-emerald-400 font-bold tracking-tight">Live Sync</div>
            <div className="mt-1 text-[11px] font-medium text-tertiary">Synchronized with Plane backend</div>
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-subtle pb-3">
        <button
          type="button"
          onClick={() => setFilterTab("all")}
          className={`text-xs rounded-xl px-3.5 py-1.5 font-bold transition-all ${
            filterTab === "all"
              ? "shadow-xs bg-accent-primary text-white"
              : "border border-subtle bg-surface-1 text-secondary hover:bg-layer-1 hover:text-primary"
          }`}
        >
          All ({rawRecords.length})
        </button>
        <button
          type="button"
          onClick={() => setFilterTab("unread")}
          className={`text-xs rounded-xl px-3.5 py-1.5 font-bold transition-all ${
            filterTab === "unread"
              ? "shadow-xs bg-accent-primary text-white"
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
        emptyMessage="No notifications found in this view."
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
              className={`group hover:border-accent-primary/40 hover:shadow-sm flex items-start justify-between gap-4 rounded-2xl border p-4 transition-all ${
                isUnread
                  ? "border-accent-primary/40 shadow-xs ring-accent-primary/20 bg-surface-1 ring-1"
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
                    <h3 className="text-xs truncate font-bold text-primary group-hover:text-accent-primary">
                      {notification.title || notification.entity_name || "Workspace Update"}
                    </h3>
                    {isUnread && (
                      <span className="rounded-full bg-accent-primary px-2 py-0.5 text-[9px] font-bold text-white">
                        New
                      </span>
                    )}
                  </div>
                  <p className="text-xs mt-1 line-clamp-2 text-secondary">
                    {notification.data?.issue?.name ?? notification.message_html ?? "View details in Plane Inbox."}
                  </p>
                  <div className="mt-2 flex items-center gap-1.5 text-[10px] text-tertiary">
                    <Clock className="size-3" />
                    <span>{notification.created_at?.slice(0, 10) || "Recent"}</span>
                  </div>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-1 text-[11px] font-semibold text-accent-primary group-hover:underline">
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
