/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import Link from "next/link";
import useSWR from "swr";
import { SummonRequestState } from "@/components/summon/request-state";
import { SummonCard, SummonMetric, SummonScreen } from "@/components/summon/screen";
import { summonService } from "@/services/summon.service";
import type { Route } from "./+types/page";

export default function SummonClientDetailPage({ params }: Route.ComponentProps) {
  const { workspaceSlug, clientId } = params;
  const { data, error, isLoading, mutate } = useSWR(["summon-client", workspaceSlug, clientId], () =>
    summonService.getClientDetail(workspaceSlug, clientId)
  );

  if (!data) return <SummonRequestState loading={isLoading} error={error} onRetry={() => void mutate()} />;

  return (
    <SummonScreen
      title={data.name}
      description={data.notes || "Client relationship profile."}
      actions={
        <Link
          href={`/${workspaceSlug}/summon/clients`}
          className="text-xs rounded-md border border-subtle px-3 py-2 text-primary"
        >
          All clients
        </Link>
      }
    >
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <SummonMetric label="Opportunities" value={data.opportunities.length} detail="Linked commercial records" />
        <SummonMetric label="Projects" value={data.projects.length} detail="Visible Plane projects" />
        <SummonMetric label="Contacts" value={data.contacts.length} detail="Client contacts" />
        <SummonMetric label="Meetings" value={data.meetings.length} detail="Linked meetings" />
      </div>
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.25fr)_minmax(18rem,0.75fr)]">
        <div className="space-y-4">
          <SummonCard>
            <h2 className="text-sm font-semibold text-primary">Active opportunities</h2>
            <div className="mt-3 divide-y divide-subtle">
              {data.opportunities.map((opportunity) => (
                <Link
                  key={opportunity.id}
                  href={`/${workspaceSlug}/summon/opportunities/${opportunity.id}`}
                  className="grid gap-1 py-3 first:pt-0 last:pb-0 sm:grid-cols-[1fr_auto]"
                >
                  <span className="text-xs font-medium text-primary">{opportunity.title}</span>
                  <span className="text-[11px] text-secondary capitalize">
                    {opportunity.stage} · {opportunity.value || "Value not set"}
                  </span>
                </Link>
              ))}
              {!data.opportunities.length ? (
                <p className="text-xs py-3 text-tertiary">No linked opportunities.</p>
              ) : null}
            </div>
          </SummonCard>
          <SummonCard>
            <h2 className="text-sm font-semibold text-primary">Plane projects</h2>
            <div className="mt-3 divide-y divide-subtle">
              {data.projects.map((project) => (
                <Link
                  key={project.id}
                  href={`/${workspaceSlug}/summon/projects/${project.id}`}
                  className="block py-3 first:pt-0 last:pb-0"
                >
                  <p className="text-xs font-medium text-primary">{project.name}</p>
                  <p className="mt-1 text-[10px] text-secondary">{project.identifier}</p>
                </Link>
              ))}
              {!data.projects.length ? <p className="text-xs py-3 text-tertiary">No visible Plane projects.</p> : null}
            </div>
          </SummonCard>
        </div>
        <div className="space-y-4">
          <SummonCard>
            <h2 className="text-sm font-semibold text-primary">Company profile</h2>
            <dl className="mt-3 space-y-3">
              <Detail label="Legal name" value={data.company_name || "Not set"} />
              <Detail label="Industry" value={data.industry || "Not set"} />
              <Detail label="Head office" value={data.head_office || "Not set"} />
              <Detail label="Website" value={data.website || "Not set"} />
              <Detail label="Relationship started" value={data.relationship_started_at || "Not set"} />
            </dl>
          </SummonCard>
          <SummonCard>
            <h2 className="text-sm font-semibold text-primary">Contacts</h2>
            <div className="mt-3 divide-y divide-subtle">
              {data.contacts.map((contact) => (
                <div key={contact.id} className="py-2.5 first:pt-0 last:pb-0">
                  <p className="text-xs font-medium text-primary">{contact.name}</p>
                  <p className="mt-1 text-[10px] text-secondary">
                    {[contact.title, contact.email || contact.phone].filter(Boolean).join(" · ")}
                  </p>
                </div>
              ))}
              {!data.contacts.length ? <p className="text-xs py-2 text-tertiary">No contacts added.</p> : null}
            </div>
          </SummonCard>
        </div>
      </div>
    </SummonScreen>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[10px] text-tertiary uppercase">{label}</dt>
      <dd className="text-xs mt-1 font-medium text-primary">{value}</dd>
    </div>
  );
}
