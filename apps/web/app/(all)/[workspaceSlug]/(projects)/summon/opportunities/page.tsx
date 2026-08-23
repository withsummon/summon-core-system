/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import {
  Check,
  ChevronDown,
  Circle,
  CircleEllipsis,
  FileText,
  Filter,
  Mail,
  MessageSquare,
  MoreHorizontal,
  Plus,
  Search,
  Sparkles,
  Star,
  Target,
  Video,
  X,
} from "lucide-react";
import { Button, Input } from "@plane/ui";
import type { ISummonOpportunityDetail, TSummonOpportunityStage } from "@plane/types";
import { PageHead } from "@/components/core/page-title";
import { SummonField, SummonSelect } from "@/components/summon/forms";
import { SummonRequestState } from "@/components/summon/request-state";
import { summonErrorMessage } from "@/components/summon/screen";
import { useMember } from "@/hooks/store/use-member";
import { summonService } from "@/services/summon.service";
import { filterOpportunityRecords } from "../reference-view-model";
import type { Route } from "./+types/page";

const stages: TSummonOpportunityStage[] = ["lead", "qualified", "proposal", "negotiation", "won", "lost"];
const stageLabel: Record<TSummonOpportunityStage, string> = {
  lead: "Lead",
  qualified: "Qualified",
  proposal: "Proposal",
  negotiation: "Negotiation",
  won: "Closed Won",
  lost: "Closed Lost",
};
const stageDot: Record<TSummonOpportunityStage, string> = {
  lead: "bg-slate-400",
  qualified: "bg-emerald-500",
  proposal: "bg-violet-500",
  negotiation: "bg-amber-500",
  won: "bg-green-500",
  lost: "bg-red-500",
};

const formatDate = (value?: string | null) => {
  if (!value) return "Not set";
  return new Intl.DateTimeFormat("en", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value));
};

const initials = (value: string) =>
  value
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

export default function SummonOpportunitiesPage({ params }: Route.ComponentProps) {
  const { workspaceSlug } = params;
  const { getUserDetails } = useMember();
  const [query, setQuery] = useState("");
  const [stage, setStage] = useState<"all" | TSummonOpportunityStage>("all");
  const [selectedId, setSelectedId] = useState("");
  const [nextStage, setNextStage] = useState<TSummonOpportunityStage>("lead");
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [transitioning, setTransitioning] = useState(false);
  const [formError, setFormError] = useState("");
  const { data, error, isLoading, mutate } = useSWR(["summon-opportunities", workspaceSlug], () =>
    summonService.listOpportunities(workspaceSlug)
  );
  const { data: clients = [] } = useSWR(["summon-clients", workspaceSlug], () =>
    summonService.listClients(workspaceSlug)
  );
  const { data: workspaceSettings } = useSWR(["summon-opportunity-settings", workspaceSlug], () =>
    summonService.getWorkspaceSettings(workspaceSlug)
  );
  const selectedListItem = data?.find((opportunity) => opportunity.id === selectedId) ?? data?.[0];
  const {
    data: detail,
    error: detailError,
    isLoading: detailLoading,
    mutate: mutateDetail,
  } = useSWR(selectedListItem ? ["summon-opportunity-master-detail", workspaceSlug, selectedListItem.id] : null, () =>
    summonService.getOpportunityDetail(workspaceSlug, selectedListItem!.id)
  );

  useEffect(() => {
    if (data?.length && !data.some((opportunity) => opportunity.id === selectedId)) setSelectedId(data[0].id);
  }, [data, selectedId]);
  useEffect(() => {
    if (detail) setNextStage(detail.stage);
  }, [detail]);

  const clientNames = useMemo(() => new Map(clients.map((client) => [client.id, client.name])), [clients]);
  const filtered = useMemo(
    () => filterOpportunityRecords(data ?? [], clientNames, query, stage),
    [clientNames, data, query, stage]
  );
  const counts = useMemo(
    () => new Map(stages.map((item) => [item, data?.filter((opportunity) => opportunity.stage === item).length ?? 0])),
    [data]
  );

  const createOpportunity = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setCreating(true);
    setFormError("");
    try {
      const created = await summonService.createOpportunity(workspaceSlug, {
        title: form.get("title"),
        client: form.get("client") || null,
        owner: form.get("owner") || null,
        product: form.get("product"),
        source: form.get("source"),
        value: form.get("value") || null,
        probability: Number(form.get("probability")),
        expected_close_date: form.get("expected_close_date") || null,
        description: form.get("description"),
        stage: form.get("stage") || "lead",
      });
      await mutate();
      setSelectedId(created.id);
      setCreateOpen(false);
    } catch (requestError) {
      setFormError(summonErrorMessage(requestError));
    } finally {
      setCreating(false);
    }
  };

  const updateStage = async () => {
    if (!detail) return;
    setTransitioning(true);
    setFormError("");
    try {
      await summonService.transitionOpportunity(workspaceSlug, detail.id, {
        stage: nextStage,
        probability: detail.probability,
      });
      await Promise.all([mutate(), mutateDetail()]);
    } catch (requestError) {
      setFormError(summonErrorMessage(requestError));
    } finally {
      setTransitioning(false);
    }
  };

  const money = (value: string | null) => {
    if (!value) return "Not set";
    const amount = Number(value);
    if (!Number.isFinite(amount)) return value;
    try {
      return new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: workspaceSettings?.currency || "IDR",
        maximumFractionDigits: 0,
      }).format(amount);
    } catch {
      return value;
    }
  };

  return (
    <section className="mx-auto min-h-full w-full max-w-[1600px] overflow-hidden p-4 lg:p-5">
      <PageHead title="Opportunities · Summon Core" />
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-primary">Opportunities</h1>
          <p className="text-xs mt-1 text-secondary">Manage your pipeline and win more deals</p>
        </div>
        <div className="flex flex-1 flex-wrap items-center justify-end gap-2">
          <div className="relative w-[430px] max-w-full">
            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-tertiary" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search opportunities, clients, products..."
              className="pl-9"
            />
          </div>
          <Button variant="neutral-primary" size="sm">
            <Filter className="mr-1.5 size-3.5" />
            Filters
          </Button>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="mr-1.5 size-3.5" />
            New Opportunity
            <ChevronDown className="ml-2 size-3.5" />
          </Button>
        </div>
      </header>

      <div className="mt-5 grid min-h-[920px] overflow-hidden rounded-2xl border border-subtle bg-surface-1 xl:grid-cols-[13rem_21rem_minmax(0,1fr)]">
        <aside className="border-b border-subtle p-4 xl:border-r xl:border-b-0">
          <h2 className="text-sm font-semibold text-primary">Pipeline</h2>
          <div className="mt-4 grid gap-1.5">
            <PipelineButton
              label="All Opportunities"
              count={data?.length ?? 0}
              active={stage === "all"}
              onClick={() => setStage("all")}
            />
            {stages.map((item) => (
              <PipelineButton
                key={item}
                label={stageLabel[item]}
                count={counts.get(item) ?? 0}
                dot={stageDot[item]}
                active={stage === item}
                onClick={() => setStage(item)}
              />
            ))}
          </div>
        </aside>

        <div className="min-w-0 border-b border-subtle xl:border-r xl:border-b-0">
          <div className="flex items-end justify-between border-b border-subtle px-4 py-4">
            <div>
              <h2 className="text-sm font-semibold text-primary">
                {stage === "all" ? "All Opportunities" : stageLabel[stage]}
              </h2>
              <p className="mt-1 text-[10px] text-secondary">{filtered.length} opportunities</p>
            </div>
            <span className="text-[10px] text-secondary">Sort: Recently Updated</span>
          </div>
          {!data ? (
            <div className="p-4">
              <SummonRequestState loading={isLoading} error={error} onRetry={() => void mutate()} />
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-4">
              <SummonRequestState empty emptyMessage="No opportunities match this pipeline filter." />
            </div>
          ) : (
            <div className="vertical-scrollbar max-h-[840px] space-y-2 overflow-y-auto p-3">
              {filtered.map((opportunity, index) => (
                <button
                  key={opportunity.id}
                  type="button"
                  onClick={() => setSelectedId(opportunity.id)}
                  className={`flex w-full items-start gap-3 rounded-xl border p-3 text-left transition-colors ${selectedListItem?.id === opportunity.id ? "border-accent-primary bg-accent-subtle/40" : "border-subtle hover:bg-layer-1"}`}
                >
                  <span
                    className={`text-sm grid size-10 flex-none place-items-center rounded-xl font-semibold ${["bg-blue-500/10 text-blue-600", "bg-violet-500/10 text-violet-600", "bg-emerald-500/10 text-emerald-600", "bg-amber-500/10 text-amber-600"][index % 4]}`}
                  >
                    {initials(opportunity.title)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="text-xs block truncate font-semibold text-primary">{opportunity.title}</span>
                    <span className="mt-1 block truncate text-[10px] text-secondary">
                      {opportunity.client ? clientNames.get(opportunity.client) || "Client" : "No client"}
                    </span>
                    <span className="mt-2 flex items-center gap-2">
                      <Badge tone="blue">{stageLabel[opportunity.stage]}</Badge>
                      <span className="text-[10px] text-tertiary">Updated {formatDate(opportunity.updated_at)}</span>
                    </span>
                  </span>
                  <MoreHorizontal className="size-4 flex-none text-tertiary" />
                </button>
              ))}
            </div>
          )}
        </div>

        <main className="min-w-0 bg-layer-1/20 p-4">
          {!detail ? (
            <SummonRequestState
              loading={detailLoading}
              error={detailError}
              empty={!selectedListItem}
              emptyMessage="Select an opportunity to inspect."
            />
          ) : (
            <OpportunityWorkspace
              detail={detail}
              workspaceSlug={workspaceSlug}
              money={money}
              ownerName={detail.owner ? getUserDetails(detail.owner)?.display_name : undefined}
              nextStage={nextStage}
              setNextStage={setNextStage}
              updateStage={updateStage}
              transitioning={transitioning}
              formError={formError}
            />
          )}
        </main>
      </div>

      {createOpen ? (
        <OpportunityForm
          clients={clients}
          saving={creating}
          error={formError}
          onClose={() => setCreateOpen(false)}
          onSubmit={createOpportunity}
        />
      ) : null}
    </section>
  );
}

function OpportunityWorkspace(props: {
  detail: ISummonOpportunityDetail;
  workspaceSlug: string;
  money: (value: string | null) => string;
  ownerName?: string;
  nextStage: TSummonOpportunityStage;
  setNextStage: (stage: TSummonOpportunityStage) => void;
  updateStage: () => Promise<void>;
  transitioning: boolean;
  formError: string;
}) {
  const { detail } = props;
  const stageIndex = stages.indexOf(detail.stage);
  const automationQuery = new URLSearchParams({
    opportunity: detail.id,
    client: detail.client ?? "",
    context: detail.title,
  }).toString();
  return (
    <div className="overflow-hidden rounded-2xl border border-subtle bg-surface-1">
      <div className="flex flex-wrap items-start justify-between gap-4 px-5 py-5">
        <div className="flex min-w-0 items-center gap-3">
          <span className="text-sm grid size-12 flex-none place-items-center rounded-xl bg-accent-subtle font-semibold text-accent-primary">
            {initials(detail.title)}
          </span>
          <div className="min-w-0">
            <h2 className="text-xl truncate font-semibold text-primary">{detail.title}</h2>
            <p className="text-xs mt-1 text-secondary">{detail.client_detail?.name || "No client"}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone="blue">{stageLabel[detail.stage]}</Badge>
          <button type="button" className="grid size-9 place-items-center rounded-lg border border-subtle">
            <Star className="size-4 text-secondary" />
          </button>
          <button type="button" className="grid size-9 place-items-center rounded-lg border border-subtle">
            <MoreHorizontal className="size-4 text-secondary" />
          </button>
          <SummonSelect
            value={props.nextStage}
            onChange={(event) => props.setNextStage(event.target.value as TSummonOpportunityStage)}
          >
            {stages.map((item) => (
              <option key={item} value={item}>
                {stageLabel[item]}
              </option>
            ))}
          </SummonSelect>
          <Button size="sm" loading={props.transitioning} onClick={() => void props.updateStage()}>
            Update Stage
          </Button>
        </div>
      </div>
      <div className="mx-5 grid overflow-hidden rounded-xl border border-subtle sm:grid-cols-2 lg:grid-cols-5">
        <Info label="Stage" value={stageLabel[detail.stage]} dot />
        <Info label="Opportunity Value" value={props.money(detail.value)} />
        <Info label="Probability" value={`${detail.probability}%`} accent />
        <Info label="Expected Close" value={formatDate(detail.expected_close_date)} />
        <Info label="Owner" value={props.ownerName || "Not assigned"} />
      </div>
      <div className="mt-4 flex gap-7 overflow-x-auto border-b border-subtle px-5">
        <button type="button" className="border-accent-primary text-xs border-b-2 py-3 font-medium text-accent-primary">
          Overview
        </button>
        {["Activities", "Documents", "Tasks", "Meetings", "Notes", "Files", "More"].map((tab) => (
          <button
            type="button"
            key={tab}
            className="text-xs border-b-2 border-transparent py-3 whitespace-nowrap text-secondary"
          >
            {tab}
          </button>
        ))}
      </div>
      {props.formError ? (
        <p className="text-xs mx-5 mt-4 rounded-lg bg-danger-subtle/20 p-3 text-danger-primary">{props.formError}</p>
      ) : null}
      <div className="grid gap-4 p-5 lg:grid-cols-2">
        <Panel title="About Opportunity">
          <p className="text-xs leading-5 text-secondary">
            {detail.description || "No opportunity description has been added."}
          </p>
          <dl className="mt-4 grid gap-2.5">
            <MiniDetail label="Solution" value={detail.product || "Not set"} />
            <MiniDetail label="Product" value={detail.product || "Not set"} />
            <MiniDetail
              label="PIC Client"
              value={detail.contacts.find((contact) => contact.is_primary)?.name || "Not set"}
            />
            <MiniDetail label="Created" value={formatDate(detail.created_at)} />
            <MiniDetail label="Source" value={detail.source || "Not set"} />
          </dl>
        </Panel>
        <Panel
          title="Next Steps"
          action={
            <Link href={`/${props.workspaceSlug}/summon/tasks/`} className="text-[10px] text-accent-primary">
              See all tasks →
            </Link>
          }
        >
          <div className="divide-y divide-subtle">
            {detail.work_items.slice(0, 4).map((item) => (
              <Link
                key={item.id}
                href={`/${props.workspaceSlug}/projects/${item.issue.project.id}/issues/${item.issue.id}/`}
                className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"
              >
                <Circle className="size-4 flex-none text-tertiary" />
                <span className="text-xs min-w-0 flex-1 truncate font-medium text-primary">{item.issue.name}</span>
                <span className="text-[10px] text-secondary">{item.issue.completed ? "Completed" : "Open"}</span>
              </Link>
            ))}
            {!detail.work_items.length ? <p className="text-xs text-tertiary">No linked work items.</p> : null}
          </div>
        </Panel>
        <Panel title="Stage Progress" className="lg:col-span-2">
          <div className="grid grid-cols-6 gap-0 pt-3">
            {stages.map((item, index) => (
              <div key={item} className="relative text-center">
                <span
                  className={`absolute top-2 left-0 h-0.5 w-full ${index <= stageIndex ? "bg-accent-primary" : "bg-layer-3"}`}
                />
                <span
                  className={`relative mx-auto grid size-4 place-items-center rounded-full border-2 bg-surface-1 ${index <= stageIndex ? "border-accent-primary" : "border-strong"}`}
                >
                  {index < stageIndex ? <Check className="size-2.5 text-accent-primary" /> : null}
                </span>
                <p
                  className={`mt-3 text-[9px] ${index === stageIndex ? "font-semibold text-accent-primary" : "text-secondary"}`}
                >
                  {stageLabel[item]}
                </p>
              </div>
            ))}
          </div>
        </Panel>
        <Panel title="Key Contacts" action={<span className="text-[10px] text-accent-primary">See all →</span>}>
          <div className="space-y-3">
            {detail.contacts.slice(0, 4).map((contact) => (
              <div key={contact.id} className="flex items-center gap-3">
                <span className="grid size-8 place-items-center rounded-full bg-layer-2 text-[10px] font-semibold text-secondary">
                  {initials(contact.name)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs truncate font-medium text-primary">{contact.name}</p>
                  <p className="mt-0.5 truncate text-[10px] text-secondary">{contact.title || "Contact"}</p>
                </div>
                {contact.email ? (
                  <a
                    href={`mailto:${contact.email}`}
                    aria-label={`Email ${contact.name}`}
                    className="grid size-7 place-items-center rounded-lg bg-accent-subtle text-accent-primary"
                  >
                    <Mail className="size-3.5" />
                  </a>
                ) : null}
              </div>
            ))}
            {!detail.contacts.length ? <p className="text-xs text-tertiary">No client contacts.</p> : null}
          </div>
        </Panel>
        <Panel
          title="Related Assets"
          action={<span className="text-[10px] text-accent-primary">View all assets →</span>}
        >
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {detail.page_contexts.slice(0, 4).map((context) => (
              <Link
                key={context.id}
                href={
                  context.project ? `/${props.workspaceSlug}/projects/${context.project}/pages/${context.page}/` : "#"
                }
                className="rounded-xl border border-subtle p-3"
              >
                <span className="bg-blue-500/10 text-blue-600 grid size-8 place-items-center rounded-lg">
                  <FileText className="size-4" />
                </span>
                <p className="mt-3 truncate text-[10px] font-medium text-primary">
                  {context.page_detail.name || "Untitled Page"}
                </p>
                <p className="mt-1 text-[9px] text-tertiary">{context.category}</p>
              </Link>
            ))}
            {detail.meetings.slice(0, Math.max(0, 4 - detail.page_contexts.length)).map((meeting) => (
              <Link
                key={meeting.id}
                href={`/${props.workspaceSlug}/summon/meetings/${meeting.id}/`}
                className="rounded-xl border border-subtle p-3"
              >
                <span className="bg-violet-500/10 text-violet-600 grid size-8 place-items-center rounded-lg">
                  <Video className="size-4" />
                </span>
                <p className="mt-3 truncate text-[10px] font-medium text-primary">{meeting.title}</p>
                <p className="mt-1 text-[9px] text-tertiary">Meeting</p>
              </Link>
            ))}
          </div>
          {!detail.page_contexts.length && !detail.meetings.length ? (
            <p className="text-xs text-tertiary">No related assets.</p>
          ) : null}
        </Panel>
        <Panel title="Recent Activity" action={<span className="text-[10px] text-accent-primary">See all →</span>}>
          <div className="space-y-3">
            {detail.recent_activity.slice(0, 4).map((activity) => (
              <Link key={activity.id} href={activity.href} className="flex items-start gap-3">
                <span className="grid size-7 flex-none place-items-center rounded-lg bg-accent-subtle text-accent-primary">
                  <MessageSquare className="size-3.5" />
                </span>
                <span className="min-w-0">
                  <span className="text-xs block truncate font-medium text-primary">{activity.label}</span>
                  <span className="mt-1 block text-[9px] text-tertiary">{formatDate(activity.created_at)}</span>
                </span>
              </Link>
            ))}
            {!detail.recent_activity.length ? <p className="text-xs text-tertiary">No recent activity.</p> : null}
          </div>
        </Panel>
      </div>
      <div className="flex flex-wrap items-center gap-2 border-t border-subtle bg-layer-1/40 p-4">
        <div className="flex min-w-[16rem] flex-1 items-center gap-3 rounded-xl border border-subtle bg-surface-1 px-3 py-2">
          <Sparkles className="size-4 text-accent-primary" />
          <span className="text-xs text-tertiary">Ask Summon Assistant about this opportunity...</span>
        </div>
        <Link
          href={`/${props.workspaceSlug}/summon/automation?${automationQuery}&intent=proposal`}
          className="text-xs rounded-xl border border-subtle px-3 py-2 font-medium text-primary"
        >
          Generate Proposal
        </Link>
        <Link
          href={`/${props.workspaceSlug}/summon/automation?${automationQuery}&intent=mom`}
          className="text-xs rounded-xl border border-subtle px-3 py-2 font-medium text-primary"
        >
          Generate MoM
        </Link>
        <Link
          href={`/${props.workspaceSlug}/summon/automation?${automationQuery}&intent=presentation`}
          className="text-xs rounded-xl border border-subtle px-3 py-2 font-medium text-primary"
        >
          Generate PPT
        </Link>
        <button type="button" className="grid size-9 place-items-center rounded-xl border border-subtle">
          <CircleEllipsis className="size-4 text-secondary" />
        </button>
      </div>
    </div>
  );
}

function PipelineButton(props: { label: string; count: number; active: boolean; dot?: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      className={`text-xs flex items-center justify-between rounded-lg px-3 py-2 ${props.active ? "bg-accent-subtle font-medium text-accent-primary" : "text-secondary hover:bg-layer-1"}`}
    >
      <span className="flex items-center gap-2">
        {props.dot ? <span className={`size-1.5 rounded-full ${props.dot}`} /> : <Target className="size-3.5" />}
        {props.label}
      </span>
      <span>{props.count}</span>
    </button>
  );
}

function Badge({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "blue" }) {
  return (
    <span
      className={`inline-flex rounded-md px-2 py-1 text-[10px] font-medium ${tone === "blue" ? "bg-blue-500/10 text-blue-600" : "bg-layer-2 text-secondary"}`}
    >
      {children}
    </span>
  );
}

function Info({ label, value, accent, dot }: { label: string; value: string; accent?: boolean; dot?: boolean }) {
  return (
    <div className="border-r border-subtle p-4 last:border-r-0">
      <p className="text-[10px] text-secondary">{label}</p>
      <p
        className={`text-xs mt-2 flex items-center gap-2 font-semibold ${accent ? "text-accent-primary" : "text-primary"}`}
      >
        {dot ? <span className="size-1.5 rounded-full bg-accent-primary" /> : null}
        {value}
      </p>
    </div>
  );
}

function Panel(props: { title: string; action?: React.ReactNode; className?: string; children: React.ReactNode }) {
  return (
    <section className={`rounded-xl border border-subtle p-4 ${props.className || ""}`}>
      <header className="mb-4 flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-primary">{props.title}</h3>
        {props.action}
      </header>
      {props.children}
    </section>
  );
}

function MiniDetail({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[6rem_minmax(0,1fr)] gap-3 text-[10px]">
      <dt className="text-secondary">{label}</dt>
      <dd className="font-medium text-primary">{value}</dd>
    </div>
  );
}

function OpportunityForm(props: {
  clients: Array<{ id: string; name: string }>;
  saving: boolean;
  error: string;
  onClose: () => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <div
      className="fixed inset-0 z-40 grid place-items-center bg-backdrop p-4"
      role="dialog"
      aria-modal="true"
      aria-label="New opportunity"
    >
      <div className="vertical-scrollbar shadow-xl max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-subtle bg-surface-1 p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-primary">New Opportunity</h2>
          <button type="button" onClick={props.onClose} aria-label="Close">
            <X className="size-4 text-secondary" />
          </button>
        </div>
        <form onSubmit={props.onSubmit} className="mt-5 grid gap-3 sm:grid-cols-2">
          <Input name="title" required placeholder="Opportunity title" />
          <SummonField label="Client">
            <SummonSelect name="client" defaultValue="">
              <option value="">No client</option>
              {props.clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </SummonSelect>
          </SummonField>
          <Input name="product" placeholder="Product" />
          <Input name="source" placeholder="Source" />
          <Input name="value" type="number" min="0" step="0.01" placeholder="Value" />
          <Input name="probability" type="number" min="0" max="100" defaultValue="0" />
          <SummonField label="Stage">
            <SummonSelect name="stage" defaultValue="lead">
              {stages.map((item) => (
                <option key={item} value={item}>
                  {stageLabel[item]}
                </option>
              ))}
            </SummonSelect>
          </SummonField>
          <SummonField label="Expected close">
            <Input name="expected_close_date" type="date" />
          </SummonField>
          <textarea
            name="description"
            rows={4}
            placeholder="Description"
            className="text-xs rounded-md border border-subtle bg-surface-1 p-2 text-primary sm:col-span-2"
          />
          {props.error ? <p className="text-xs text-danger-primary sm:col-span-2">{props.error}</p> : null}
          <div className="flex justify-end gap-2 sm:col-span-2">
            <Button type="button" variant="neutral-primary" onClick={props.onClose}>
              Cancel
            </Button>
            <Button type="submit" loading={props.saving}>
              <Plus className="mr-1.5 size-3.5" />
              Create opportunity
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
