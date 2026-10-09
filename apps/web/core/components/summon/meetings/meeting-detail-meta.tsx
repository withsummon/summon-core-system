/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { FunctionReturnType } from "convex/server";
import type { api } from "@summon/convex/api";
import { Avatar } from "@plane/ui";

type Props = {
  data: FunctionReturnType<typeof api.meetings.index.get>;
  participants: FunctionReturnType<typeof api.meetings.index.participants> | undefined;
  organizer: string | null;
  createdAt: string;
};

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="shadow-sm rounded-xl border border-subtle bg-surface-1">
      <div className="border-b border-subtle px-4 py-3.5">
        <h2 className="text-sm font-semibold text-primary">{title}</h2>
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

export function MeetingDetailMeta({ data, participants, organizer, createdAt }: Props) {
  return (
    <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
      <Panel title="Meeting Details">
        <dl className="grid grid-cols-2 gap-x-6 gap-y-4 text-[11px] sm:grid-cols-3">
          <Detail label="Status" value={data.status} />
          <Detail label="Organizer" value={organizer || "Not available"} />
          <Detail label="Created At" value={createdAt} />
          <Detail label="Time Zone" value={Intl.DateTimeFormat().resolvedOptions().timeZone} />
          <Detail label="Participants" value={`${participants?.length ?? "…"} people`} />
          <Detail label="Location" value={data.location || "Not supplied"} />
          <Detail label="Recording" value={data.recordingAssetId ? "Yes" : "No"} />
          <Detail label="Visibility" value="Not supplied" />
        </dl>
      </Panel>
      <Panel title={`Participants (${participants?.length ?? "…"})`}>
        <div className="space-y-3">
          {participants?.slice(0, 5).map((participant) => (
            <div key={participant.id} className="flex items-center gap-2.5">
              <Avatar size={26} name={participant.name ?? participant.email ?? "Workspace member"} />
              <p className="min-w-0 flex-1 truncate text-[11px] font-medium text-primary">
                {participant.name ?? participant.email ?? "Workspace member"}
              </p>
              <span className="text-[10px] text-tertiary capitalize">{participant.response}</span>
            </div>
          ))}
          {participants?.length === 0 ? <p className="text-xs text-tertiary">No participants added.</p> : null}
          {participants && participants.length > 5 ? (
            <p className="text-[11px] font-medium text-secondary">+{participants.length - 5} more participants</p>
          ) : null}
        </div>
      </Panel>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[10px] text-tertiary">{label}</dt>
      <dd className="mt-1 truncate font-medium text-primary capitalize">{value}</dd>
    </div>
  );
}
