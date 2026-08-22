/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import React from "react";
import Link from "next/link";
import { CalendarDays, Video, Clock } from "lucide-react";
import type { ISummonHomeSummary } from "@plane/types";

interface IUpcomingMeetingsCardProps {
  meetings: ISummonHomeSummary["upcoming_meetings"];
  workspaceSlug: string;
}

export function UpcomingMeetingsCard({ meetings, workspaceSlug }: IUpcomingMeetingsCardProps) {
  return (
    <div className="shadow-sm rounded-2xl border border-subtle bg-surface-1 p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="bg-purple-500/10 text-purple-600 dark:text-purple-400 flex size-7 items-center justify-center rounded-lg">
            <CalendarDays className="size-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-primary">Upcoming Meetings</h3>
            <p className="text-[11px] text-tertiary">Client & team sync sessions</p>
          </div>
        </div>
        <Link
          href={`/${workspaceSlug}/summon/knowledge/`}
          className="text-xs font-semibold text-accent-primary hover:underline"
        >
          View all →
        </Link>
      </div>

      <div className="mt-4 space-y-2.5">
        {meetings.length > 0 ? (
          meetings.slice(0, 4).map((meeting) => (
            <Link
              key={meeting.id}
              href={`/${workspaceSlug}/summon/knowledge/`}
              className="group hover:border-accent-primary/40 flex items-start gap-3 rounded-xl border border-subtle bg-layer-1 p-2.5 transition-all hover:bg-layer-2"
            >
              <div className="bg-purple-500/10 text-purple-600 flex size-7 shrink-0 items-center justify-center rounded-lg">
                <Video className="size-3.5" />
              </div>
              <div className="min-w-0 flex-1">
                <h4 className="text-xs truncate font-semibold text-primary group-hover:text-accent-primary">
                  {meeting.title}
                </h4>
                <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-tertiary">
                  <Clock className="size-3" />
                  <span>
                    {new Date(meeting.starts_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                  </span>
                  <span>·</span>
                  <span>
                    {new Date(meeting.starts_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
              </div>
            </Link>
          ))
        ) : (
          <div className="text-xs py-4 text-center text-tertiary">No upcoming meetings scheduled.</div>
        )}
      </div>
    </div>
  );
}
