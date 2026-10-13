/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { ExternalLink, FileText } from "lucide-react";
import type { ISummonClientDetail } from "@plane/types";
import { SummonPanel } from "@/components/summon/screen";
import { Detail, formatDate, HealthRow } from "./client-detail-shared";
import type { TPanelLink } from "./client-detail-shared";

export function ClientOverviewAside(props: {
  data: ISummonClientDetail;
  ownerName: string | undefined;
  notesLink: TPanelLink;
}) {
  const { data, ownerName, notesLink } = props;
  return (
    <aside className="min-w-0 space-y-4">
      <SummonPanel title="Relationship Health">
        <span className="inline-flex rounded-full bg-layer-2 px-2 py-1 text-12 font-medium text-secondary">
          Not scored
        </span>
        <p className="mt-2 text-12 leading-4 text-secondary">No relationship-health data source is configured.</p>
        <div className="mt-4 space-y-3">
          <HealthRow label="Communication records" detail={`${data.meetings.length} meetings linked`} />
          <HealthRow label="Projects tracked" detail={`${data.projects.length} visible projects`} />
          <HealthRow label="Client contacts" detail={`${data.contacts.length} contacts recorded`} />
        </div>
      </SummonPanel>

      <SummonPanel title="Client Information">
        <dl className="space-y-4">
          <Detail label="Legal Name" value={data.company_name || "Not set"} />
          <Detail label="Industry" value={data.industry || "Not set"} />
          <div className="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-3 text-12">
            <dt className="text-secondary">Website</dt>
            <dd className="min-w-0 font-medium text-primary">
              {data.website ? (
                <a
                  href={data.website}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex max-w-full items-center gap-1 truncate text-accent-primary"
                >
                  {data.website.replace(/^https?:\/\//, "")}
                  <ExternalLink className="size-3 shrink-0" />
                </a>
              ) : (
                "Not set"
              )}
            </dd>
          </div>
          <Detail label="Head Office" value={data.head_office || "Not set"} />
          <Detail label="Client Since" value={formatDate(data.relationship_started_at)} />
          <Detail label="Account Manager" value={ownerName || "Not assigned"} />
        </dl>
      </SummonPanel>

      <SummonPanel title="Notes" link={notesLink}>
        <div className="space-y-2">
          {data.page_contexts.slice(0, 3).map((context) => (
            <div key={context.id} className="flex min-w-0 gap-3 rounded-lg border border-subtle p-3">
              <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-accent-subtle text-accent-primary">
                <FileText className="size-3.5" />
              </span>
              <div className="min-w-0">
                <p className="truncate text-12 font-semibold text-primary">
                  {context.page_detail.name || "Untitled page"}
                </p>
                <p className="mt-1 text-12 text-secondary">{formatDate(context.updated_at)}</p>
              </div>
            </div>
          ))}
          {!data.page_contexts.length ? <p className="py-4 text-12 text-tertiary">No linked notes.</p> : null}
        </div>
      </SummonPanel>
    </aside>
  );
}
