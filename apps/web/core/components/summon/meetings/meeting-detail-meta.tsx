/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { ISummonMeeting } from "@plane/types";
import { Avatar } from "@plane/ui";
import { SummonPanel } from "@/components/summon/screen";

type Props = {
  data: ISummonMeeting;
  organizer?: string;
  createdAt: string;
};

export function MeetingDetailMeta({ data, organizer, createdAt }: Props) {
  return (
    <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
      <SummonPanel title="Meeting Details">
        <dl className="grid grid-cols-2 gap-x-6 gap-y-4 text-12 sm:grid-cols-3">
          <Detail label="Status" value={data.status} />
          <Detail label="Organizer" value={organizer || "Not available"} />
          <Detail label="Created At" value={createdAt} />
          <Detail label="Time Zone" value={Intl.DateTimeFormat().resolvedOptions().timeZone} />
          <Detail label="Participants" value={`${data.participants.length} people`} />
          <Detail label="Location" value={data.location || "Not supplied"} />
          <Detail label="Recording" value={data.recording_asset_detail ? "Yes" : "No"} />
          <Detail label="Visibility" value="Not supplied" />
        </dl>
      </SummonPanel>
      <SummonPanel title="Participants" count={data.participants.length}>
        <div className="space-y-3">
          {data.participants.slice(0, 5).map((participant) => (
            <div key={participant.id} className="flex items-center gap-2.5">
              <Avatar size={26} name={participant.member.display_name} />
              <p className="min-w-0 flex-1 truncate text-12 font-medium text-primary">
                {participant.member.display_name}
              </p>
              <span className="text-12 text-tertiary capitalize">{participant.response}</span>
            </div>
          ))}
          {!data.participants.length ? <p className="text-xs text-tertiary">No participants added.</p> : null}
          {data.participants.length > 5 ? (
            <p className="text-12 font-medium text-secondary">+{data.participants.length - 5} more participants</p>
          ) : null}
        </div>
      </SummonPanel>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-12 text-tertiary">{label}</dt>
      <dd className="mt-1 truncate font-medium text-primary capitalize">{value}</dd>
    </div>
  );
}
