/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import Link from "next/link";
import { Archive, Calendar, History, SignalMedium, Tag, Triangle, Trash2, Users } from "lucide-react";
import type { FunctionReturnType } from "convex/server";
import type { api } from "@summon/convex/api";
import type { Id } from "@summon/convex/data-model";
import { Avatar } from "@plane/propel/avatar";
import { CycleIcon, ModuleIcon, WorkItemsIcon } from "@plane/propel/icons";
import { calculateTimeAgo } from "@plane/utils";
import { AuthenticatedAssetImage } from "@/components/convex-core/assets/image";
import { ProfileActivityMessage } from "@/components/convex-core/tasks/activity/activity";
import { ActivityChanges } from "@/components/convex-core/tasks/activity/changes";

type Event = FunctionReturnType<typeof api.tasks.activity.profile>["page"][number];
type Change = NonNullable<Event["changes"]>[number];
const icons = {
  title: <WorkItemsIcon className="size-3 text-secondary" aria-hidden="true" />,
  priority: <SignalMedium className="size-3 text-secondary" aria-hidden="true" />,
  state: <WorkItemsIcon className="size-3 text-secondary" aria-hidden="true" />,
  startDate: <Calendar className="size-3 text-secondary" aria-hidden="true" />,
  targetDate: <Calendar className="size-3 text-secondary" aria-hidden="true" />,
  archivedAt: <Archive className="size-3 text-secondary" aria-hidden="true" />,
  deletedAt: <Trash2 className="size-3 text-secondary" aria-hidden="true" />,
  cycle: <CycleIcon className="size-3 text-secondary" aria-hidden="true" />,
  modules: <ModuleIcon className="size-3 text-secondary" aria-hidden="true" />,
  estimate: <Triangle className="size-3 text-secondary" aria-hidden="true" />,
  assignees: <Users className="size-3 text-secondary" aria-hidden="true" />,
  labels: <Tag className="size-3 text-secondary" aria-hidden="true" />,
  vote: <History className="size-3 text-secondary" aria-hidden="true" />,
} satisfies Record<Change["field"], React.ReactNode>;

export function ActivityList({ activity, currentUserId }: { activity: Event[]; currentUserId: Id<"users"> }) {
  return (
    <ul role="list">
      {activity.map((event) => (
        <li key={event.id} className="relative pb-1">
          <div className="relative flex items-start space-x-2">
            <div className="mt-4 px-1.5">
              <div className="mt-1.5 flex h-6 w-6 items-center justify-center">
                {event.kind !== "created" ? (
                  event.changes?.[0] ? (
                    icons[event.changes[0].field]
                  ) : (
                    <History className="size-3 text-secondary" aria-hidden="true" />
                  )
                ) : event.avatar ? (
                  <AuthenticatedAssetImage
                    asset={event.avatar}
                    alt="Member avatar"
                    compactName={event.actorName ?? "Member"}
                    className="font-normal size-6 rounded-full border-0 object-cover text-13"
                  />
                ) : (
                  <Avatar name={event.actorName ?? "Member"} size="base" />
                )}
              </div>
            </div>
            <div className="min-w-0 flex-1 border-b border-subtle py-4">
              <p className="text-13 break-words text-secondary">
                <Link
                  href={"/" + event.workspaceSlug + "/profile/" + event.actorId}
                  className="font-medium text-primary hover:underline"
                >
                  {currentUserId === event.actorId ? "You" : (event.actorName ?? "Member")}
                </Link>{" "}
                <ProfileActivityMessage event={event} />{" "}
                <time className="whitespace-nowrap" dateTime={new Date(event.at).toISOString()}>
                  {calculateTimeAgo(new Date(event.at).toISOString())}
                </time>
              </p>
              {event.changes && <ActivityChanges changes={event.changes} />}
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
