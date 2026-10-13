/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import useSWR from "swr";
import { Plus } from "lucide-react";
import { Button } from "@plane/propel/button";
import { TextArea } from "@plane/propel/input";
import { Select } from "@plane/propel/select";
import { Input } from "@plane/ui";
import type { ISummonOpportunity, TSummonOpportunityStage } from "@plane/types";
import { PageHead } from "@/components/core/page-title";
import { SummonField } from "@/components/summon/forms";
import { opportunityCreateIntent } from "@/components/summon/opportunities/delivery-handoff";
import { OpportunityInspector, initials } from "@/components/summon/opportunities/opportunity-inspector";
import { MoneyInput } from "@/components/summon/money-input";
import { useWorkspaceCurrency, useWorkspaceMoney } from "@/components/summon/use-workspace-money";
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
import { SummonPageHeader, summonErrorMessage, summonPageClassName, ViewPanel } from "@/components/summon/screen";
import { useMember } from "@/hooks/store/use-member";
import { summonService } from "@/services/summon.service";
import { filterOpportunityRecords } from "../reference-view-model";
import { SummonAccessGate } from "@/components/summon/access-gate";
import type { Route } from "./+types/page";
import { Dialog, EDialogWidth } from "@plane/propel/dialog";
import { DatePicker } from "@plane/propel/date-picker";
import { SummonSearchField } from "@/components/summon/search-field";
import { renderFormattedDate } from "@plane/utils";

const formatShortDate = (value?: string | null) =>
  (value ? renderFormattedDate(new Date(value), "MMM d") : undefined) ?? null;

export default function SummonOpportunitiesPage(props: Route.ComponentProps) {
  return (
    <SummonAccessGate workspaceSlug={props.params.workspaceSlug} capability="commercial.view" title="Opportunities">
      <SummonOpportunitiesPageContent {...props} />
    </SummonAccessGate>
  );
}

function SummonOpportunitiesPageContent({ params }: Route.ComponentProps) {
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
  } = useSWR(selected ? ["summon-opportunity", workspaceSlug, selected.id] : null, () =>
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
    <section className={summonPageClassName}>
      <PageHead title="Opportunities · Summon Core" />
      <SummonPageHeader
        title="Opportunities"
        description={
          <span className="tabular-nums">
            {data ? `${data.length} in pipeline · ${counts.get("won") ?? 0} won` : "Loading pipeline"}
          </span>
        }
        actions={
          <>
            <SummonSearchField
              label="Search opportunities"
              placeholder="Search title, client, product"
              value={query}
              onValueChange={setQuery}
              className="w-full sm:w-80"
            />
            <Button size="lg" onClick={() => setCreateOpen(true)}>
              <Plus />
              New opportunity
            </Button>
          </>
        }
      />

      <StageFilter
        stage={stage}
        total={searched.length}
        counts={counts}
        onSelect={(next) => router.replace(hrefFor({ stage: next }))}
      />

      <div className="@container">
        <div className="grid grid-cols-1 overflow-hidden rounded-xl border border-subtle bg-surface-1 shadow-xs @3xl:h-[calc(100dvh-15.5rem)] @3xl:min-h-[34rem] @3xl:grid-cols-[minmax(17rem,20rem)_minmax(0,1fr)] @5xl:grid-cols-[23rem_minmax(0,1fr)]">
          <div
            className={`min-h-0 flex-col border-subtle @3xl:flex @3xl:border-r ${explicit ? "hidden" : "flex"}`}
            aria-label="Opportunity results"
            role="region"
          >
            <OpportunityResults
              data={data}
              isLoading={isLoading}
              error={error}
              onRetry={() => void mutate()}
              groups={groups}
              hasVisible={visible.length > 0}
              query={query}
              stage={stage}
              clientNames={clientNames}
              selectedId={selected?.id}
              workspaceSlug={workspaceSlug}
              hrefFor={hrefFor}
              onClearQuery={() => setQuery("")}
              onShowAllStages={() => router.replace(hrefFor({ stage: "all" }))}
            />
          </div>

          <div
            className={`vertical-scrollbar min-h-0 overflow-y-auto bg-layer-1/25 p-4 lg:p-5 @3xl:block ${explicit ? "block" : "hidden"}`}
          >
            <OpportunityInspectorPane
              workspaceSlug={workspaceSlug}
              selectedId={selected?.id}
              inspected={inspected}
              detailLoading={detailLoading}
              detailError={detailError}
              backHref={hrefFor({ opportunity: null })}
              onChanged={() => Promise.all([mutate(), mutateDetail()])}
              onRetry={() => void mutateDetail()}
            />
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

type TOpportunityGroups = Array<{ stage: TSummonOpportunityStage; items: ISummonOpportunity[] }>;

function OpportunityResults(props: {
  data: ISummonOpportunity[] | undefined;
  isLoading: boolean;
  error: unknown;
  onRetry: () => void;
  groups: TOpportunityGroups;
  hasVisible: boolean;
  query: string;
  stage: TStageFilter;
  clientNames: Map<string, string>;
  selectedId: string | undefined;
  workspaceSlug: string;
  hrefFor: (next: { stage?: TStageFilter; opportunity?: string | null }) => string;
  onClearQuery: () => void;
  onShowAllStages: () => void;
}) {
  const {
    data,
    isLoading,
    error,
    onRetry,
    groups,
    hasVisible,
    query,
    stage,
    clientNames,
    selectedId,
    workspaceSlug,
    hrefFor,
    onClearQuery,
    onShowAllStages,
  } = props;
  return !data ? (
    <div className="p-4">
      <SummonRequestState loading={isLoading} error={error} onRetry={onRetry} />
    </div>
  ) : !hasVisible ? (
    <div className="grid gap-3 p-6 text-center">
      <p className="text-13 font-medium text-primary">No opportunities match</p>
      <p className="text-12 text-secondary">
        {query ? `Nothing matches “${query}”` : "This stage is empty"}
        {stage !== "all" ? ` in ${OPPORTUNITY_STAGE_LABEL[stage]}.` : "."}
      </p>
      <div className="flex justify-center gap-2">
        {query ? (
          <Button size="xl" variant="secondary" onClick={onClearQuery}>
            Clear search
          </Button>
        ) : null}
        {stage !== "all" ? (
          <Button size="xl" variant="secondary" onClick={onShowAllStages}>
            Show all stages
          </Button>
        ) : null}
      </div>
    </div>
  ) : (
    <div className="vertical-scrollbar min-h-0 flex-1 overflow-y-auto">
      <ViewPanel value={stage}>
        {groups.map((group) => (
          <section key={group.stage} aria-label={OPPORTUNITY_STAGE_LABEL[group.stage]}>
            <h2 className="sticky top-0 z-10 flex h-9 items-center gap-2 border-b border-subtle bg-layer-1/95 px-4 text-12 font-semibold text-secondary backdrop-blur">
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
                  selected={selectedId === opportunity.id}
                  workspaceSlug={workspaceSlug}
                />
              ))}
            </ul>
          </section>
        ))}
      </ViewPanel>
    </div>
  );
}

function OpportunityInspectorPane(props: {
  workspaceSlug: string;
  selectedId: string | undefined;
  inspected: Parameters<typeof OpportunityInspector>[0]["detail"] | undefined;
  detailLoading: boolean;
  detailError: unknown;
  backHref: string;
  onChanged: () => Promise<unknown>;
  onRetry: () => void;
}) {
  const { workspaceSlug, selectedId, inspected, detailLoading, detailError, backHref, onChanged, onRetry } = props;
  return inspected ? (
    <OpportunityInspector
      workspaceSlug={workspaceSlug}
      detail={inspected}
      onChanged={onChanged}
      backHref={backHref}
      backClassName="@3xl:hidden"
    />
  ) : (
    <SummonRequestState
      loading={Boolean(selectedId) && (detailLoading || !detailError)}
      error={detailError}
      empty={!selectedId}
      emptyAsset="opportunity"
      emptyTitle="No opportunities here"
      emptyMessage="Change the stage or search to see opportunities."
      onRetry={onRetry}
    />
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
      <Select
        aria-label="Filter by stage"
        value={stage}
        onValueChange={(next) => props.onSelect(next as TStageFilter)}
        options={[
          { value: "all", label: `All stages · ${total}` },
          ...OPPORTUNITY_STAGES.map((item) => ({
            value: item,
            label: `${OPPORTUNITY_STAGE_LABEL[item]} · ${counts.get(item) ?? 0}`,
          })),
        ]}
        className="w-full sm:hidden"
      />
      <div
        role="group"
        aria-label="Filter by stage"
        className="-mx-1 scrollbar-hide hidden gap-1 overflow-x-auto px-1 py-0.5 sm:flex"
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
      className={`inline-flex h-10 flex-none items-center gap-2 rounded-lg px-3 text-12 font-medium transition-[background-color,color,scale] duration-150 focus-visible:outline-2 focus-visible:outline-accent-strong focus-visible:outline-solid active:scale-[0.96] motion-reduce:transition-none ${props.active ? "bg-layer-3 text-primary ring-1 ring-strong" : "text-secondary hover:bg-layer-2 hover:text-primary"}`}
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
  const money = useWorkspaceMoney(props.workspaceSlug);
  const owner = opportunity.owner ? getUserDetails(opportunity.owner)?.display_name : undefined;
  const closeDate = formatShortDate(opportunity.expected_close_date);
  return (
    <li className="border-b border-subtle last:border-b-0">
      <Link
        href={props.href}
        scroll={false}
        aria-current={props.selected ? "true" : undefined}
        className={`group relative flex gap-3 px-4 py-3 transition-colors duration-150 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent-strong focus-visible:outline-solid motion-reduce:transition-none ${props.selected ? "bg-accent-subtle/60" : "hover:bg-layer-1"}`}
      >
        {props.selected ? (
          <span aria-hidden className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-accent-primary" />
        ) : null}
        <span
          aria-hidden
          className={`mt-1.5 size-2 flex-none rounded-full ${OPPORTUNITY_STAGE_TONE[opportunity.stage].dot}`}
        />
        <span className="min-w-0 flex-1">
          <span className="line-clamp-2 text-13 leading-snug font-medium text-primary" title={opportunity.title}>
            {opportunity.title}
          </span>
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
          {opportunity.value ? (
            <span className="text-12 font-medium text-primary tabular-nums">{money(opportunity.value)}</span>
          ) : null}
          {opportunity.probability || owner ? (
            <span className="flex items-center gap-1.5 text-12 text-secondary tabular-nums">
              {opportunity.probability ? `${opportunity.probability}%` : null}
              {owner ? (
                <span
                  title={owner}
                  className="grid size-6 place-items-center rounded-full bg-layer-3 text-12 font-semibold text-secondary"
                >
                  {initials(owner)}
                  <span className="sr-only">Owner: {owner}</span>
                </span>
              ) : null}
            </span>
          ) : null}
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
  const currency = useWorkspaceCurrency(props.workspaceSlug);
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
      <Dialog.Panel width={EDialogWidth.XXL}>
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
              <MoneyInput name="value" currency={currency} placeholder="0" className="h-10" />
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
                <TextArea name="description" rows={3} />
              </SummonField>
            </div>
          </div>
          {error ? (
            <p role="alert" className="rounded-lg bg-danger-subtle/20 px-3 py-2 text-12 text-danger-primary">
              {error}
            </p>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button type="button" size="xl" variant="secondary" className="h-10" onClick={close} disabled={saving}>
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
