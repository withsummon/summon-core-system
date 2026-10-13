/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import {
  ArrowCounterClockwiseIcon,
  ArrowsDownUpIcon,
  ClockCounterClockwiseIcon,
  EnvelopeSimpleIcon,
  ProhibitIcon,
  UserPlusIcon,
  XIcon,
} from "@phosphor-icons/react";
import type { Icon } from "@phosphor-icons/react";
import type { ISummonAccessEvent } from "@plane/types";
import { calculateTimeAgo, renderFormattedDate } from "@plane/utils";
import { roleLabel } from "./roles";

const EVENT_PRESENTATION: Record<
  ISummonAccessEvent["kind"],
  { icon: Icon; describe: (e: ISummonAccessEvent) => string }
> = {
  invited: { icon: EnvelopeSimpleIcon, describe: (e) => `invited ${e.target_email} as ${roleLabel(e.to_role)}` },
  added: { icon: UserPlusIcon, describe: (e) => `added ${e.target_email} as ${roleLabel(e.to_role)}` },
  invite_revoked: { icon: XIcon, describe: (e) => `revoked the invite for ${e.target_email}` },
  role_changed: {
    icon: ArrowsDownUpIcon,
    describe: (e) => `changed ${e.target_email} from ${roleLabel(e.from_role)} to ${roleLabel(e.to_role)}`,
  },
  deactivated: { icon: ProhibitIcon, describe: (e) => `deactivated ${e.target_email}` },
  restored: { icon: ArrowCounterClockwiseIcon, describe: (e) => `restored ${e.target_email}` },
};

/** Who changed whose access, newest first. The API never edits or deletes these rows. */
export function AccessHistory(props: { events?: ISummonAccessEvent[]; isLoading: boolean }) {
  const { events, isLoading } = props;
  return (
    <section aria-labelledby="access-history" className="grid gap-2">
      <h2 id="access-history" className="flex items-center gap-1.5 text-12 font-medium text-tertiary">
        <ClockCounterClockwiseIcon className="size-3.5" />
        Access history
      </h2>
      {isLoading ? (
        <p className="text-13 text-tertiary">Loading history…</p>
      ) : !events?.length ? (
        <p className="rounded-xl border border-dashed border-subtle px-4 py-6 text-center text-13 text-tertiary">
          Invites, role changes, and deactivations will show up here.
        </p>
      ) : (
        <ol className="rounded-xl border border-subtle bg-surface-1 px-4 shadow-xs">
          {events.map((event) => {
            const { icon: EventIcon, describe } = EVENT_PRESENTATION[event.kind];
            return (
              <li key={event.id} className="flex items-start gap-3 border-b border-subtle py-2.5 last:border-b-0">
                <span className="mt-0.5 grid size-6 flex-none place-items-center rounded-full bg-layer-1 text-secondary">
                  <EventIcon className="size-3.5" />
                </span>
                <p className="min-w-0 flex-1 text-13 text-secondary">
                  <span className="font-medium text-primary">{event.actor?.name ?? "Someone"}</span> {describe(event)}
                </p>
                <time
                  dateTime={event.created_at}
                  title={renderFormattedDate(event.created_at) ?? undefined}
                  className="flex-none text-12 text-tertiary tabular-nums"
                >
                  {calculateTimeAgo(event.created_at)}
                </time>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
