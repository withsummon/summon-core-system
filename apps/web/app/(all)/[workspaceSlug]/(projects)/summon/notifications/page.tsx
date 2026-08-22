/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import Link from "next/link";
import { observer } from "mobx-react";
import useSWR from "swr";
import { SummonScreen } from "@/components/summon/screen";
import { SummonRequestState } from "@/components/summon/request-state";
import { useWorkspaceNotifications } from "@/hooks/store/notifications";
import { useWorkspace } from "@/hooks/store/use-workspace";
import type { Route } from "./+types/page";

export default observer(function SummonNotificationsPage({ params }: Route.ComponentProps) {
  const { getNotifications, loader, notificationIdsByWorkspaceId, notifications } = useWorkspaceNotifications();
  const { currentWorkspace } = useWorkspace();
  const { error, isLoading, mutate } = useSWR(["summon-notifications", params.workspaceSlug], () =>
    getNotifications(params.workspaceSlug)
  );
  const records =
    (currentWorkspace ? notificationIdsByWorkspaceId(currentWorkspace.id) : [])?.map((id) => notifications[id]) ?? [];

  return (
    <SummonScreen
      title="Notifications"
      description="Your native Plane notification feed. Read, archive, snooze, and preferences remain in Plane."
      actions={
        <>
          <Link
            href={`/${params.workspaceSlug}/notifications/`}
            className="text-xs text-on-accent rounded-md bg-accent-primary px-3 py-2 font-medium"
          >
            Open Plane Inbox
          </Link>
          <Link href={`/${params.workspaceSlug}/settings/`} className="text-xs font-medium text-accent-primary">
            Notification settings
          </Link>
        </>
      }
    >
      <SummonRequestState
        loading={isLoading || !!loader}
        error={error}
        empty={!isLoading && !loader && records.length === 0}
        emptyMessage="No Plane notifications right now."
        onRetry={() => void mutate()}
      />
      <div className="space-y-3">
        {records.map((notification) => (
          <Link
            key={notification.id}
            href={`/${params.workspaceSlug}/notifications/`}
            className="block rounded-2xl border border-subtle bg-surface-1 p-4 hover:bg-layer-1 focus-visible:outline focus-visible:outline-2"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-primary">
                  {notification.title || notification.entity_name || "Plane update"}
                </p>
                <p className="text-xs mt-1 text-secondary">
                  {notification.data?.issue?.name ?? notification.message_html ?? "Open Plane Inbox for details."}
                </p>
              </div>
              {!notification.read_at ? (
                <span className="rounded-full bg-accent-subtle px-2 py-1 text-[10px] text-accent-primary">Unread</span>
              ) : null}
            </div>
          </Link>
        ))}
      </div>
    </SummonScreen>
  );
});
