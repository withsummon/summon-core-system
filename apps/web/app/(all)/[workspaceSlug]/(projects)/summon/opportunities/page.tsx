/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import useSWR from "swr";
import { Plus, Search } from "lucide-react";
import { Button } from "@plane/propel/button";
import { Input } from "@plane/ui";
import type { ISummonOpportunity, TSummonOpportunityStage } from "@plane/types";
import { PageHead } from "@/components/core/page-title";
import { SummonField } from "@/components/summon/forms";
import { opportunityCreateIntent } from "@/components/summon/opportunities/delivery-handoff";
import {
  OpportunityInspector,
  initials,
  useOpportunityMoney,
} from "@/components/summon/opportunities/opportunity-inspector";
import {
  OPPORTUNITY_STAGES,
  OPPORTUNITY_STAGE_LABEL,
  OPPORTUNITY_STAGE_TONE,
  type TStageFilter,
  groupByStage,
  opportunitiesHref,
  parseStageFilter,
  resolveOpportunitySelection,
  stageCounts,
} from "@/components/summon/opportunities/opportunity-pipeline";
import { SummonRequestState } from "@/components/summon/request-state";
import { summonErrorMessage } from "@/components/summon/screen";
import { useMember } from "@/hooks/store/use-member";
import { summonService } from "@/services/summon.service";
import { filterOpportunityRecords } from "../reference-view-model";
import type { Route } from "./+types/page";
import { Select } from "@plane/propel/select";
import { Dialog, EDialogWidth } from "@plane/propel/dialog";
import { DatePicker } from "@plane/propel/date-picker";

const formatShortDate = (value?: string | null) =>
  value ? new Intl.DateTimeFormat("en", { day: "numeric", month: "short" }).format(new Date(value)) : null;

export default function SummonOpportunitiesPage({ params }: Route.ComponentProps) {
  const { workspaceSlug } = params;
  const router = useRouter();
  const searchParams = useSearchParams();
  const createIntent = opportunityCreateIntent(searchParams);
  const stage = parseStageFilter(searchParams.get("stage"));
  const requestedId = searchParams.get("opportunity");
  const [query, setQuery] = useState("");
  const [createOpen, setCreateOpen] = useState(createIntent.open);
  const { data, error, isLoading, mutate } = useSWR(["summon-opportunities", workspaceSlug], () =>
    summonService.listOpportunities(workspaceSlug)
  );
  const { data: clients = [] } = useSWR(["summon-clients", workspaceSlug], () =>
    summonService.listClients(workspaceSlug)
  );
  const clientNames = useMemo(
    () => new Map(clients.map((client) => [client.id, client.company_name || client.name])),
    [clients]
  );
  const searched = useMemo(
    () => filterOpportunityRecords(data ?? [], clientNames, query, "all"),
    [clientNames, data, query]
  );
  const visible = useMemo(() => searched.filter((item) => stage === "all" || item.stage === stage), [searched, stage]);
  const counts = useMemo(() => stageCounts(searched), [searched]);
  const groups = useMemo(() => groupByStage(visible), [visible]);
  // Resolve against display order so the passive fallback is the first row on screen.
  const { selected, explicit } = resolveOpportunitySelection(
    groups.flatMap((group) => group.items),
    requestedId
  );
  const {
    data: detail,
    error: detailError,
    isLoading: detailLoading,
    mutate: mutateDetail,
  } = useSWR(selected ? ["summon-opportunity-master-detail", workspaceSlug, selected.id] : null, () =>
    summonService.getOpportunityDetail(workspaceSlug, selected!.id)
  );
  const inspected = detail && detail.id === selected?.id ? detail : undefined;

  const hrefFor = (next: { stage?: TStageFilter; opportunity?: string | null }) =>
    opportunitiesHref(workspaceSlug, { stage, opportunity: requestedId, ...next });

  const closeCreate = () => {
    setCreateOpen(false);
    if (createIntent.open) router.replace(hrefFor({}));
  };

  const onCreated = async (created: ISummonOpportunity) => {
    await mutate();
    // Keep the new record visible so the inspector can show it.
    const hidden = !filterOpportunityRecords([created], clientNames, query, stage).length;
    if (hidden) setQuery("");
    setCreateOpen(false);
    router.push(opportunitiesHref(workspaceSlug, { stage: hidden ? "all" : stage, opportunity: created.id }));
  };

  return (
    <section className="mx-auto flex min-h-full w-full max-w-[1600px] flex-col gap-4 p-4 lg:p-5">
      <PageHead title="Opportunities · Summon Core" />
      <header className="flex flex-wrap items-center gap-3">
        <div className="mr-auto">
          <h1 className="text-20 font-semibold tracking-tight text-primary">Opportunities</h1>
          <p className="mt-0.5 text-12 text-secondary tabular-nums">
            {data ? `${data.length} in pipeline · ${counts.get("won") ?? 0} won` : "Loading pipeline"}
          </p>
        </div>
        <div role="search" className="relative w-full min-w-0 sm:w-80">
          <Search aria-hidden className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-tertiary" />
          <Input
            type="search"
            aria-label="Search opportunities"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search title, client, product"
            className="h-10 w-full pl-9"
          />
        </div>
        <Button size="xl" className="h-10" onClick={() => setCreateOpen(true)}>
          <Plus className="size-4" />
          New opportunity
        </Button>
      </header>

      <StageFilter
        stage={stage}
        total={searched.length}
        counts={counts}
        onSelect={(next) => router.replace(hrefFor({ stage: next }))}
      />

      <div className="@container">
        <div className="grid overflow-hidden rounded-2xl bg-surface-1 shadow-[0_1px_2px_rgba(15,23,42,0.06),0_8px_24px_-12px_rgba(15,23,42,0.12)] ring-1 ring-subtle @3xl:h-[calc(100dvh-15.5rem)] @3xl:min-h-[34rem] @3xl:grid-cols-[minmax(17rem,20rem)_minmax(0,1fr)] @5xl:grid-cols-[23rem_minmax(0,1fr)]">
          <div
            className={`min-h-0 flex-col border-subtle @3xl:flex @3xl:border-r ${explicit ? "hidden" : "flex"}`}
            aria-label="Opportunity results"
            role="region"
          >
            {!data ? (
              <div className="p-4">
                <SummonRequestState loading={isLoading} error={error} onRetry={() => void mutate()} />
              </div>
            ) : !visible.length ? (
              <div className="grid gap-3 p-6 text-center">
                <p className="text-13 font-medium text-primary">No opportunities match</p>
                <p className="text-12 text-secondary">
                  {query ? `Nothing matches “${query}”` : "This stage is empty"}
                  {stage !== "all" ? ` in ${OPPORTUNITY_STAGE_LABEL[stage]}.` : "."}
                </p>
                <div className="flex justify-center gap-2">
                  {query ? (
                    <Button size="xl" variant="secondary" onClick={() => setQuery("")}>
                      Clear search
                    </Button>
                  ) : null}
                  {stage !== "all" ? (
                    <Button
                      size="xl"
                      variant="secondary"
                      onClick={() => router.replace(hrefFor({ stage: "all" }))}
                    >
                      Show all stages
                    </Button>
                  ) : null}
                </div>
              </div>
            ) : (
              <div className="vertical-scrollbar min-h-0 flex-1 overflow-y-auto">
                {groups.map((group) => (
                  <section key={group.stage} aria-label={OPPORTUNITY_STAGE_LABEL[group.stage]}>
                    <h2 className="sticky top-0 z-10 flex h-9 items-center gap-2 border-b border-subtle bg-layer-1/95 px-4 text-11 font-semibold text-secondary backdrop-blur">
                      <span aria-hidden className={`size-2 rounded-full ${OPPORTUNITY_STAGE_TONE[group.stage].dot}`} />
                      {OPPORTUNITY_STAGE_LABEL[group.stage]}
                      <span className="font-normal text-tertiary tabular-nums">{group.items.length}</span>
                    </h2>
                    <ul>
                      {group.items.map((opportunity) => (
                        <OpportunityRow
                          key={opportunity.id}
                          opportunity={opportunity}
                          clientName={opportunity.client ? clientNames.get(opportunity.client) : undefined}
                          href={hrefFor({ opportunity: opportunity.id })}
                          selected={selected?.id === opportunity.id}
                          workspaceSlug={workspaceSlug}
                        />
                      ))}
                    </ul>
                  </section>
                ))}
              </div>
            )}
          </div>

          <div
            className={`vertical-scrollbar min-h-0 overflow-y-auto bg-layer-1/25 p-4 lg:p-5 @3xl:block ${explicit ? "block" : "hidden"}`}
          >
            {inspected ? (
              <OpportunityInspector
                workspaceSlug={workspaceSlug}
                detail={inspected}
                onChanged={() => Promise.all([mutate(), mutateDetail()])}
                backHref={hrefFor({ opportunity: null })}
                backClassName="@3xl:hidden"
              />
            ) : (
              <SummonRequestState
                loading={Boolean(selected) && (detailLoading || !detailError)}
                error={detailError}
                empty={!selected}
                emptyMessage="No opportunity to show for these filters."
                onRetry={() => void mutateDetail()}
              />
            )}
          </div>
        </div>
      </div>

      <CreateOpportunityDialog
        isOpen={createOpen}
        workspaceSlug={workspaceSlug}
        clients={clients}
        defaultClient={createIntent.client}
        defaultStage={stage === "all" ? "lead" : stage}
        onClose={closeCreate}
        onCreated={onCreated}
      />
    </section>
  );
}

function StageFilter(props: {
  stage: TStageFilter;
  total: number;
  counts: Map<TSummonOpportunityStage, number>;
  onSelect: (stage: TStageFilter) => void;
}) {
  const { stage, total, counts } = props;
  return (
    <div className="grid gap-2">
      <div
        role="group"
        aria-label="Filter by stage"
        className="-mx-1 scrollbar-hide flex gap-1 overflow-x-auto px-1 py-0.5"
      >
        <FilterChip active={stage === "all"} onClick={() => props.onSelect("all")} label="All" count={total} />
        {OPPORTUNITY_STAGES.map((item) => (
          <FilterChip
            key={item}
            active={stage === item}
            onClick={() => props.onSelect(item)}
            label={OPPORTUNITY_STAGE_LABEL[item]}
            count={counts.get(item) ?? 0}
            dot={OPPORTUNITY_STAGE_TONE[item].dot}
          />
        ))}
      </div>
      {total ? (
        <div aria-hidden className="flex h-1.5 gap-0.5 overflow-hidden rounded-full bg-layer-2">
          {OPPORTUNITY_STAGES.map((item) =>
            counts.get(item) ? (
              <span
                key={item}
                className={`h-full transition-[flex-grow,opacity] duration-300 motion-reduce:transition-none ${OPPORTUNITY_STAGE_TONE[item].bar} ${stage === "all" || stage === item ? "opacity-100" : "opacity-30"}`}
                style={{ flexGrow: counts.get(item) }}
              />
            ) : null
          )}
        </div>
      ) : null}
    </div>
  );
}

function FilterChip(props: { active: boolean; onClick: () => void; label: string; count: number; dot?: string }) {
  return (
    <button
      type="button"
      aria-pressed={props.active}
      onClick={props.onClick}
      className={`inline-flex h-10 flex-none items-center gap-2 rounded-lg px-3 text-12 font-medium transition-[background-color,color,scale] duration-150 focus-visible:outline-2 focus-visible:outline-accent-strong active:scale-[0.96] motion-reduce:transition-none ${props.active ? "bg-layer-3 text-primary ring-1 ring-strong" : "text-secondary hover:bg-layer-2 hover:text-primary"}`}
    >
      {props.dot ? <span aria-hidden className={`size-2 rounded-full ${props.dot}`} /> : null}
      {props.label}
      <span className={`tabular-nums ${props.active ? "text-secondary" : "text-tertiary"}`}>{props.count}</span>
    </button>
  );
}

function OpportunityRow(props: {
  opportunity: ISummonOpportunity;
  clientName?: string;
  href: string;
  selected: boolean;
  workspaceSlug: string;
}) {
  const { opportunity } = props;
  const { getUserDetails } = useMember();
  const money = useOpportunityMoney(props.workspaceSlug);
  const owner = opportunity.owner ? getUserDetails(opportunity.owner)?.display_name : undefined;
  const closeDate = formatShortDate(opportunity.expected_close_date);
  return (
    <li className="border-b border-subtle last:border-b-0">
      <Link
        href={props.href}
        scroll={false}
        aria-current={props.selected ? "true" : undefined}
        className={`group relative flex gap-3 px-4 py-3 transition-colors duration-150 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent-strong motion-reduce:transition-none ${props.selected ? "bg-accent-subtle/60" : "hover:bg-layer-1"}`}
      >
        {props.selected ? (
          <span aria-hidden className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-accent-primary" />
        ) : null}
        <span
          aria-hidden
          className={`mt-1.5 size-2 flex-none rounded-full ${OPPORTUNITY_STAGE_TONE[opportunity.stage].dot}`}
        />
        <span className="min-w-0 flex-1">
          <span className="line-clamp-2 text-13 leading-snug font-medium text-primary">{opportunity.title}</span>
          <span className="mt-1 flex flex-wrap items-center gap-x-1.5 text-12 text-secondary">
            <span className="truncate">{props.clientName || "No client"}</span>
            {closeDate ? (
              <>
                <span aria-hidden>·</span>
                <span className="whitespace-nowrap">Close {closeDate}</span>
              </>
            ) : null}
          </span>
        </span>
        <span className="flex flex-none flex-col items-end gap-1.5">
          <span className="text-12 font-medium text-primary tabular-nums">
            {opportunity.value ? money(opportunity.value) : "—"}
          </span>
          <span className="flex items-center gap-1.5 text-11 text-secondary tabular-nums">
            {opportunity.probability}%
            <span
              title={owner || "No owner"}
              className="grid size-5 place-items-center rounded-full bg-layer-3 text-9 font-semibold text-secondary"
            >
              {owner ? initials(owner) : "–"}
              <span className="sr-only">Owner: {owner || "not assigned"}</span>
            </span>
          </span>
        </span>
      </Link>
    </li>
  );
}

function CreateOpportunityDialog(props: {
  isOpen: boolean;
  workspaceSlug: string;
  clients: Array<{ id: string; name: string; company_name: string }>;
  defaultClient: string;
  defaultStage: TSummonOpportunityStage;
  onClose: () => void;
  onCreated: (created: ISummonOpportunity) => Promise<void>;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const close = () => {
    if (saving) return;
    setError("");
    props.onClose();
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving) return;
    const form = new FormData(event.currentTarget);
    const title = String(form.get("title") ?? "").trim();
    if (!title) {
      setError("Give the opportunity a title.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const created = await summonService.createOpportunity(props.workspaceSlug, {
        title,
        client: form.get("client") || null,
        product: form.get("product"),
        source: form.get("source"),
        value: form.get("value") || null,
        probability: Number(form.get("probability") || 0),
        expected_close_date: form.get("expected_close_date") || null,
        description: form.get("description"),
        stage: form.get("stage") || "lead",
      });
      await props.onCreated(created);
    } catch (requestError) {
      setError(summonErrorMessage(requestError));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={props.isOpen} onOpenChange={(open) => !open && close()}>
      <Dialog.Panel
        width={EDialogWidth.XXL}
        className="vertical-scrollbar max-h-[90vh] w-[calc(100vw-2rem)] overflow-y-auto rounded-2xl"
      >
        <form onSubmit={submit} noValidate className="grid gap-4 p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <Dialog.Title className="text-14 font-semibold text-primary">New opportunity</Dialog.Title>
              <p className="mt-1 text-12 text-secondary">Only the title is required. You can fill in the rest later.</p>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <SummonField label="Title">
                <Input name="title" required aria-required className="h-10" hasError={Boolean(error) && !saving} />
              </SummonField>
            </div>
            <SummonField label="Client">
              {/* Remount once clients load so a preselected client's option exists for defaultValue. */}
              <Select
                name="client"
                defaultValue={props.defaultClient}
                className="h-10"
                options={[
                  { value: "", label: "No client" },
                  ...props.clients.map((client) => ({ value: client.id, label: client.company_name || client.name })),
                ]}
              />
            </SummonField>
            <SummonField label="Stage">
              <Select
                name="stage"
                defaultValue={props.defaultStage}
                className="h-10"
                options={OPPORTUNITY_STAGES.map((item) => ({ value: item, label: OPPORTUNITY_STAGE_LABEL[item] }))}
              />
            </SummonField>
            <SummonField label="Value">
              <Input name="value" type="number" min="0" step="0.01" inputMode="decimal" className="h-10" />
            </SummonField>
            <SummonField label="Probability (%)">
              <Input name="probability" type="number" min="0" max="100" step="1" defaultValue="0" className="h-10" />
            </SummonField>
            <SummonField label="Expected close">
              <DatePicker name="expected_close_date" className="h-10" />
            </SummonField>
            <SummonField label="Product">
              <Input name="product" className="h-10" />
            </SummonField>
            <SummonField label="Source">
              <Input name="source" placeholder="e.g. Referral" className="h-10" />
            </SummonField>
            <div className="sm:col-span-2">
              <SummonField label="Description">
                <textarea
                  name="description"
                  rows={3}
                  className="rounded-md border border-strong bg-surface-1 p-2 text-13 text-primary outline-none focus:border-accent-strong"
                />
              </SummonField>
            </div>
          </div>
          {error ? (
            <p role="alert" className="rounded-lg bg-danger-subtle/20 px-3 py-2 text-12 text-danger-primary">
              {error}
            </p>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              size="xl"
              variant="secondary"
              className="h-10"
              onClick={close}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button type="submit" size="xl" className="h-10" loading={saving}>
              {saving ? "Creating…" : "Create opportunity"}
            </Button>
          </div>
        </form>
      </Dialog.Panel>
    </Dialog>
  );
}
