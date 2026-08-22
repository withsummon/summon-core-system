/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import Link from "next/link";
import useSWR from "swr";
import { SummonRequestState } from "@/components/summon/request-state";
import { SummonCard, SummonScreen } from "@/components/summon/screen";
import { summonService } from "@/services/summon.service";
import type { Route } from "./+types/page";

export default function SummonClientDetailPage({ params }: Route.ComponentProps) {
  const { workspaceSlug, clientId } = params;
  const { data, error, isLoading, mutate } = useSWR(["summon-client", workspaceSlug, clientId], () =>
    summonService.getClientDetail(workspaceSlug, clientId)
  );

  if (!data) return <SummonRequestState loading={isLoading} error={error} onRetry={() => void mutate()} />;

  const automationQuery = new URLSearchParams({ client: data.id, context: data.name }).toString();
  return (
    <SummonScreen
      title={data.name}
      description={data.description || "Commercial account profile and authorized delivery context."}
      actions={
        <>
          <Link
            href={`/${workspaceSlug}/summon/clients/`}
            className="text-xs rounded-xl border border-subtle px-3 py-2 font-medium text-primary focus-visible:outline focus-visible:outline-2"
          >
            All clients
          </Link>
          <Link
            href={`/${workspaceSlug}/summon/automation?${automationQuery}`}
            className="text-xs rounded-xl bg-accent-primary px-3 py-2 font-medium text-on-color focus-visible:outline focus-visible:outline-2"
          >
            Open Automation
          </Link>
        </>
      }
    >
      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(18rem,0.85fr)]">
        <div className="space-y-4">
          <SummonCard>
            <h2 className="text-sm font-semibold text-primary">Client profile</h2>
            <dl className="mt-4 grid gap-3 sm:grid-cols-2">
              <Detail label="Status" value={data.status} />
              <Detail label="Industry" value={data.industry || "Not set"} />
              <Detail label="Owner" value={data.owner || "Unassigned"} />
              <Detail label="Created" value={data.created_at.slice(0, 10)} />
            </dl>
          </SummonCard>
          <RecordCard
            title="Contacts"
            empty="No contacts yet."
            items={data.contacts.map((contact) => ({
              id: contact.id,
              title: contact.name,
              detail: [contact.role, contact.email || contact.phone].filter(Boolean).join(" · "),
              badge: contact.is_primary ? "Primary" : undefined,
            }))}
          />
          <RecordCard
            title="Pipeline"
            empty="No opportunities yet."
            items={data.opportunities.map((opportunity) => ({
              id: opportunity.id,
              href: `/${workspaceSlug}/summon/opportunities/${opportunity.id}/`,
              title: opportunity.title,
              detail: opportunity.value
                ? `Value ${opportunity.value} · ${opportunity.probability}%`
                : `${opportunity.probability}% probability`,
              badge: opportunity.stage,
            }))}
          />
          <SummonCard>
            <h2 className="text-xs font-semibold text-primary">Commercial notes</h2>
            <p className="text-xs mt-3 whitespace-pre-wrap text-secondary">
              {data.description || "No commercial notes yet."}
            </p>
          </SummonCard>
        </div>
        <div className="space-y-4">
          <RecordCard
            title="Authorized projects"
            empty="No linked delivery projects."
            items={data.projects.map((project) => ({
              id: project.id,
              href: `/${workspaceSlug}/projects/${project.id}/issues/`,
              title: project.name,
              detail: project.identifier,
            }))}
          />
          <RecordCard
            title="Pages and context"
            empty="No accessible Plane Pages."
            items={data.page_contexts.map((context) => ({
              id: context.id,
              href: context.project
                ? `/${workspaceSlug}/projects/${context.project}/pages/${context.page}/`
                : undefined,
              title: context.page_detail.name || "Untitled Page",
              detail: [context.category, context.tags.join(", ")].filter(Boolean).join(" · "),
            }))}
          />
          <RecordCard
            title="Meetings"
            empty="No linked meetings."
            items={data.meetings.map((meeting) => ({
              id: meeting.id,
              href: `/${workspaceSlug}/summon/meetings/`,
              title: meeting.title,
              detail: meeting.starts_at.slice(0, 10),
              badge: meeting.status,
            }))}
          />
          <RecordCard
            title="Recent activity"
            empty="No recent delivery activity."
            items={data.recent_activity.map((activity) => ({
              id: activity.id,
              href: activity.href,
              title: activity.label,
              detail: activity.created_at.slice(0, 10),
            }))}
          />
        </div>
      </div>
    </SummonScreen>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[10px] font-medium tracking-wide text-tertiary uppercase">{label}</dt>
      <dd className="text-xs mt-1 font-medium text-primary">{value}</dd>
    </div>
  );
}

function RecordCard(props: {
  title: string;
  empty: string;
  items: Array<{ id: string; href?: string; title: string; detail?: string; badge?: string }>;
}) {
  return (
    <SummonCard>
      <h2 className="text-xs font-semibold text-primary">{props.title}</h2>
      <div className="mt-3 divide-y divide-subtle">
        {props.items.map((item) => {
          const content = (
            <>
              <span className="min-w-0 flex-1">
                <span className="text-xs block truncate font-medium text-primary">{item.title}</span>
                {item.detail ? (
                  <span className="mt-1 block truncate text-[10px] text-secondary">{item.detail}</span>
                ) : null}
              </span>
              {item.badge ? (
                <span className="rounded-full bg-layer-2 px-2 py-1 text-[10px] text-secondary">{item.badge}</span>
              ) : null}
            </>
          );
          return item.href ? (
            <Link
              key={item.id}
              href={item.href}
              className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0 hover:opacity-80"
            >
              {content}
            </Link>
          ) : (
            <div key={item.id} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
              {content}
            </div>
          );
        })}
        {!props.items.length ? <p className="text-xs py-2 text-tertiary">{props.empty}</p> : null}
      </div>
    </SummonCard>
  );
}
