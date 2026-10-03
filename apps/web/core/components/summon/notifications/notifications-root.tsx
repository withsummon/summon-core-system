/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useEffect, useState } from "react";
import { useOutletContext } from "react-router";
import { useConvexConnectionState } from "convex/react";
import { usePaginatedQuery } from "convex-helpers/react";
import { api } from "@summon/convex/api";
import type { WorkspaceSession } from "@/components/workspace/native-shell/session";
import Link from "next/link";
import { Bell, CheckCircle2, Inbox, Clock, ExternalLink, MessageSquare, AlertTriangle } from "lucide-react";
import { Button } from "@plane/propel/button";
import { SummonRequestState } from "@/components/summon/request-state";
import { PreservedWorkspaceShell } from "@/components/workspace/native-shell/workspace-shell";
import { useStickiesCommands } from "@/components/stickies/native/provider";

export function NotificationsRoot() {
  const session = useOutletContext<WorkspaceSession>();
  const { workspace } = session;
  const workspaceSlug = workspace.slug;
  const commands = useStickiesCommands();
  const connection = useConvexConnectionState();
  const [filterTab, setFilterTab] = useState<"all" | "unread">("all");
  const [now, setNow] = useState(Date.now);
  const [browsing, setBrowsing] = useState(false);
  useEffect(() => {
    const refresh = () => {
      if (!browsing && document.visibilityState === "visible") setNow(Date.now());
    };
    const interval = setInterval(refresh, 30_000);
    window.addEventListener("focus", refresh);
    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", refresh);
    };
  }, [browsing]);
  const feed = usePaginatedQuery(
    api.notifications.index.list,
    {
      workspaceId: workspace._id,
      view: "inbox",
      unreadOnly: filterTab === "unread",
      now,
    },
    { initialNumItems: 30 }
  );
  const counts = usePaginatedQuery(
    api.notifications.index.summary,
    {
      workspaceId: workspace._id,
      now,
    },
    { initialNumItems: 100 }
  );
  const { status: countStatus, loadMore: loadMoreCounts } = counts;
  useEffect(() => {
    if (countStatus === "CanLoadMore") loadMoreCounts(100);
  }, [countStatus, loadMoreCounts]);
  const total = counts.results.reduce((sum, page) => sum + page.total, 0);
  const unreadCount = counts.results.reduce((sum, page) => sum + page.unread, 0);
  const counting = counts.status !== "Exhausted";
  const loading = feed.status === "LoadingFirstPage";
  const filteredRecords = feed.results;
  return (
    <PreservedWorkspaceShell
      {...session}
      onCreateSticky={commands.create}
      onOpenStickies={commands.openAll}
      beforeLeave={commands.flushAll}
    >
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
              <div className="text-2xl font-bold tracking-tight text-primary">
                {counting ? "≥ " : ""}
                {total}
              </div>
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
              <div className="text-2xl text-amber-600 dark:text-amber-400 font-bold tracking-tight">
                {counting ? "≥ " : ""}
                {unreadCount}
              </div>
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
              <div className="text-2xl text-emerald-600 dark:text-emerald-400 font-bold tracking-tight" role="status">
                {connection.isWebSocketConnected ? "Live Sync" : "Connecting…"}
              </div>
              <div className="mt-1 text-[11px] font-medium text-tertiary">Synchronized with Convex</div>
            </div>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-2 border-b border-subtle pb-3">
          <button
            type="button"
            aria-pressed={filterTab === "all"}
            onClick={() => {
              setFilterTab("all");
              setBrowsing(false);
              setNow(Date.now());
            }}
            className={`text-xs rounded-xl px-3.5 py-1.5 font-bold transition-all ${
              filterTab === "all"
                ? "shadow-xs bg-accent-primary text-white"
                : "border border-subtle bg-surface-1 text-secondary hover:bg-layer-1 hover:text-primary"
            }`}
          >
            All ({counting ? "≥ " : ""}
            {total})
          </button>
          <button
            type="button"
            aria-pressed={filterTab === "unread"}
            onClick={() => {
              setFilterTab("unread");
              setBrowsing(false);
              setNow(Date.now());
            }}
            className={`text-xs rounded-xl px-3.5 py-1.5 font-bold transition-all ${
              filterTab === "unread"
                ? "shadow-xs bg-accent-primary text-white"
                : "border border-subtle bg-surface-1 text-secondary hover:bg-layer-1 hover:text-primary"
            }`}
          >
            Unread ({counting ? "≥ " : ""}
            {unreadCount})
          </button>
        </div>

        <SummonRequestState
          loading={loading}
          empty={feed.status === "Exhausted" && filteredRecords.length === 0}
          emptyMessage="No notifications found in this view."
        />

        {/* Notifications List */}
        <div className="space-y-3">
          {filteredRecords.map((notification) => {
            const isUnread = notification.readAt === null;

            return (
              <Link
                key={notification._id}
                href={`/${workspaceSlug}/notifications/?${new URLSearchParams({ notification: notification._id, notificationTask: notification.taskId, notificationProject: notification.projectId, ...(notification.event?.commentId ? { comment: notification.event.commentId } : {}) })}`}
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
                        {notification.taskReference}
                      </h3>
                      {isUnread && (
                        <span className="rounded-full bg-accent-primary px-2 py-0.5 text-[9px] font-bold text-white">
                          New
                        </span>
                      )}
                    </div>
                    <p className="text-xs mt-1 line-clamp-2 text-secondary">{notification.taskTitle}</p>
                    <div className="mt-2 flex items-center gap-1.5 text-[10px] text-tertiary">
                      <Clock className="size-3" />
                      <span>{new Date(notification._creationTime).toLocaleDateString()}</span>
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
        {(feed.status === "CanLoadMore" || feed.status === "LoadingMore") && (
          <Button
            variant="secondary"
            loading={feed.status === "LoadingMore"}
            onClick={() => {
              setBrowsing(true);
              feed.loadMore(30);
            }}
          >
            Load more updates
          </Button>
        )}
      </div>
    </PreservedWorkspaceShell>
  );
}
