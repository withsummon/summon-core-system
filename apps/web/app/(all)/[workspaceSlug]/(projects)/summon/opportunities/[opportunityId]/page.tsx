/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import { Button, Input } from "@plane/ui";
import Link from "next/link";
import useSWR from "swr";
import { SummonField, SummonSelect } from "@/components/summon/forms";
import { SummonRequestState } from "@/components/summon/request-state";
import { SummonCard, SummonScreen, summonErrorMessage } from "@/components/summon/screen";
import { summonService } from "@/services/summon.service";
import type { Route } from "./+types/page";

const stages = ["lead", "qualified", "proposal", "negotiation", "won", "lost"] as const;

function isOpportunityStage(value: string) {
  return stages.some((stage) => stage === value);
}

export default function SummonOpportunityDetailPage({ params }: Route.ComponentProps) {
  const { workspaceSlug, opportunityId } = params;
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const { data, error, isLoading, mutate } = useSWR(["summon-opportunity", workspaceSlug, opportunityId], () =>
    summonService.getOpportunityDetail(workspaceSlug, opportunityId)
  );

  if (!data) return <SummonRequestState loading={isLoading} error={error} onRetry={() => void mutate()} />;

  const transition = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const stage = form.get("stage");
    const probability = Number(form.get("probability"));
    if (
      typeof stage !== "string" ||
      !isOpportunityStage(stage) ||
      !Number.isInteger(probability) ||
      probability < 0 ||
      probability > 100
    ) {
      setFormError("Choose a stage and a probability from 0 to 100.");
      return;
    }
    setSaving(true);
    setFormError("");
    try {
      await summonService.transitionOpportunity(workspaceSlug, opportunityId, { stage, probability });
      await mutate();
    } catch (requestError) {
      setFormError(summonErrorMessage(requestError));
    } finally {
      setSaving(false);
    }
  };

  const automationQuery = new URLSearchParams({
    opportunity: data.id,
    client: data.client ?? "",
    context: data.title,
  }).toString();
  return (
    <SummonScreen
      title={data.title}
      description={data.description || "Commercial opportunity and authorized delivery context."}
      actions={
        <Link
          href={`/${workspaceSlug}/summon/opportunities/`}
          className="text-xs rounded-xl border border-subtle px-3 py-2 font-medium text-primary focus-visible:outline focus-visible:outline-2"
        >
          All opportunities
        </Link>
      }
    >
      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(18rem,0.85fr)]">
        <div className="space-y-4">
          <SummonCard>
            <h2 className="text-sm font-semibold text-primary">Opportunity details</h2>
            <dl className="mt-4 grid gap-3 sm:grid-cols-2">
              <Detail label="Client" value={data.client_detail?.name || "No client"} />
              <Detail label="Value" value={data.value || "Not set"} />
              <Detail label="Probability" value={`${data.probability}%`} />
              <Detail label="Expected close" value={data.expected_close_date || "Not set"} />
            </dl>
          </SummonCard>
          <SummonCard>
            <h2 className="text-xs font-semibold text-primary">Client contacts</h2>
            <div className="mt-3 divide-y divide-subtle">
              {data.contacts.map((contact) => (
                <div key={contact.id} className="py-2.5 first:pt-0 last:pb-0">
                  <p className="text-xs font-medium text-primary">{contact.name}</p>
                  <p className="mt-1 text-[10px] text-secondary">
                    {[contact.role, contact.email || contact.phone].filter(Boolean).join(" · ") || "Contact"}
                  </p>
                </div>
              ))}
              {!data.contacts.length ? <p className="text-xs py-2 text-tertiary">No client contacts.</p> : null}
            </div>
          </SummonCard>
          <SummonCard>
            <h2 className="text-xs font-semibold text-primary">Linked work</h2>
            {data.project_profile ? (
              <Link
                href={`/${workspaceSlug}/projects/${data.project_profile.project}/issues/`}
                className="text-xs mt-3 block font-medium text-accent-primary"
              >
                Open delivery project in Plane →
              </Link>
            ) : (
              <p className="text-xs mt-3 text-tertiary">No delivery project has been linked.</p>
            )}
            <div className="mt-3 divide-y divide-subtle">
              {data.work_items.map((workItem) => (
                <Link
                  key={workItem.id}
                  href={`/${workspaceSlug}/projects/${workItem.issue.project.id}/issues/${workItem.issue.id}/`}
                  className="block py-2.5 first:pt-0 last:pb-0"
                >
                  <p className="text-xs font-medium text-primary">{workItem.issue.name}</p>
                  <p className="mt-1 text-[10px] text-secondary">{workItem.issue.project.identifier}</p>
                </Link>
              ))}
            </div>
          </SummonCard>
        </div>
        <div className="space-y-4">
          <SummonCard>
            <h2 className="text-xs font-semibold text-primary">Pipeline transition</h2>
            <form key={`${data.id}-${data.updated_at}`} onSubmit={transition} className="mt-3 grid gap-3">
              <SummonField label="Stage">
                <SummonSelect name="stage" defaultValue={data.stage}>
                  {stages.map((stage) => (
                    <option key={stage} value={stage}>
                      {stage}
                    </option>
                  ))}
                </SummonSelect>
              </SummonField>
              <SummonField label="Probability">
                <Input name="probability" type="number" min="0" max="100" step="1" defaultValue={data.probability} />
              </SummonField>
              <Button type="submit" loading={saving}>
                Save transition
              </Button>
              {formError ? <p className="text-xs text-danger-primary">{formError}</p> : null}
            </form>
          </SummonCard>
          <Link
            href={`/${workspaceSlug}/summon/automation?${automationQuery}&intent=proposal`}
            className="text-xs block rounded-2xl border border-subtle bg-surface-1 p-3.5 font-medium text-accent-primary"
          >
            Prepare proposal in Automation →
          </Link>
          <Link
            href={`/${workspaceSlug}/summon/automation?${automationQuery}&intent=quotation`}
            className="text-xs block rounded-2xl border border-subtle bg-surface-1 p-3.5 font-medium text-accent-primary"
          >
            Prepare quotation in Automation →
          </Link>
          <ContextCard
            title="Pages and context"
            empty="No accessible Plane Pages."
            items={data.page_contexts.map((context) => ({
              id: context.id,
              href: context.project
                ? `/${workspaceSlug}/projects/${context.project}/pages/${context.page}/`
                : undefined,
              title: context.page_detail.name || "Untitled Page",
              detail: context.category,
            }))}
          />
          <ContextCard
            title="Meetings"
            empty="No linked meetings."
            items={data.meetings.map((meeting) => ({
              id: meeting.id,
              href: `/${workspaceSlug}/summon/meetings/`,
              title: meeting.title,
              detail: meeting.starts_at.slice(0, 10),
            }))}
          />
          <ContextCard
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

function ContextCard(props: {
  title: string;
  empty: string;
  items: Array<{ id: string; href?: string; title: string; detail?: string }>;
}) {
  return (
    <SummonCard>
      <h2 className="text-xs font-semibold text-primary">{props.title}</h2>
      <div className="mt-3 divide-y divide-subtle">
        {props.items.map((item) => {
          const content = (
            <>
              <p className="text-xs truncate font-medium text-primary">{item.title}</p>
              {item.detail ? <p className="mt-1 truncate text-[10px] text-secondary">{item.detail}</p> : null}
            </>
          );
          return item.href ? (
            <Link key={item.id} href={item.href} className="block py-2.5 first:pt-0 last:pb-0">
              {content}
            </Link>
          ) : (
            <div key={item.id} className="py-2.5 first:pt-0 last:pb-0">
              {content}
            </div>
          );
        })}
        {!props.items.length ? <p className="text-xs py-2 text-tertiary">{props.empty}</p> : null}
      </div>
    </SummonCard>
  );
}
