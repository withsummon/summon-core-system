import Link from "next/link";
import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "convex/react";
import { usePaginatedQuery } from "convex-helpers/react";
import type { FunctionReturnType } from "convex/server";
import type { Doc } from "@summon/convex/data-model";
import { api } from "@summon/convex/api";
import { Plus, Search } from "lucide-react";
import { Button } from "@plane/propel/button";
import { Input } from "@plane/ui";
import { PageHead } from "@/components/core/page-title";
import {
  OpportunityInspector,
  initials,
  opportunityMoney,
} from "@/components/summon/opportunities/opportunity-inspector";
import {
  OPPORTUNITY_STAGES,
  OPPORTUNITY_STAGE_LABEL,
  OPPORTUNITY_STAGE_TONE,
  type TStageFilter,
  groupByStage,
  opportunitiesHref,
  parseStageFilter,
  stageCounts,
} from "@/components/summon/opportunities/opportunity-pipeline";
import { SummonRequestState } from "@/components/summon/request-state";
import { memberLabel } from "@summon/convex/member-label";
import { OpportunityForm } from "./opportunity-form";

const formatShortDate = (value: string | null) =>
  value ? new Intl.DateTimeFormat("en", { day: "numeric", month: "short" }).format(new Date(value)) : null;

export function Opportunities({
  workspace,
}: {
  workspace: FunctionReturnType<typeof api.workspaces.index.list>[number];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const stage = parseStageFilter(searchParams.get("stage"));
  const query = searchParams.get("search") ?? "";
  const requestedId = searchParams.get("opportunity");
  const creating = searchParams.get("create") === "1";
  const context = useQuery(api.commercial.opportunities.get, {
    workspaceId: workspace._id,
    opportunityId: null,
    clientId: creating ? searchParams.get("client") : null,
    ...(creating && stage !== "all" ? { createStage: stage } : {}),
  });
  const {
    results: contributions,
    status: countStatus,
    loadMore: loadMoreCounts,
  } = usePaginatedQuery(
    api.commercial.opportunities.counts,
    { workspaceId: workspace._id, search: query },
    { initialNumItems: 100 }
  );
  useEffect(() => {
    if (countStatus === "CanLoadMore") loadMoreCounts(100);
  }, [countStatus, loadMoreCounts]);
  const counts = countStatus === "Exhausted" ? stageCounts(contributions) : null;
  const total = contributions.reduce((sum, row) => sum + row.count, 0);
  const hrefFor = (next: { stage?: TStageFilter; opportunity?: string | null; search?: string; create?: boolean }) =>
    opportunitiesHref(workspace.slug, { stage, opportunity: requestedId, search: query, ...next });
  if (!context) return <SummonRequestState loading />;
  return (
    <section className="mx-auto flex min-h-full w-full max-w-[1600px] flex-col gap-4 p-4 lg:p-5">
      <PageHead title="Opportunities · Summon Core" />
      <header className="flex flex-wrap items-center gap-3">
        <div className="mr-auto">
          <h1 className="text-20 font-semibold tracking-tight text-primary">Opportunities</h1>
          <p className="mt-0.5 text-12 text-secondary tabular-nums">
            {counts ? `${total} in pipeline · ${counts.get("won") ?? 0} won` : "Pipeline"}
          </p>
        </div>
        <div role="search" className="relative w-full min-w-0 sm:w-80">
          <Search aria-hidden className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-tertiary" />
          <Input
            type="search"
            aria-label="Search opportunities"
            value={query}
            onChange={(event) => router.replace(hrefFor({ search: event.target.value }))}
            placeholder="Search title, client, product"
            className="h-10 w-full pl-9"
          />
        </div>
        {context.canWrite && (
          <Button size="xl" className="h-10" onClick={() => router.push(hrefFor({ create: true }))}>
            <Plus className="size-4" />
            New opportunity
          </Button>
        )}
      </header>
      <StageFilter
        stage={stage}
        total={counts ? total : null}
        counts={counts}
        onSelect={(next) => router.replace(hrefFor({ stage: next }))}
      />
      <OpportunityDirectory
        workspace={workspace}
        context={context}
        stage={stage}
        query={query}
        requestedId={requestedId}
        counts={counts}
        hrefFor={hrefFor}
      />
      {creating && context.canWrite && (
        <OpportunityForm
          key={`${context.input.clientId}:${context.input.stage}`}
          workspaceId={workspace._id}
          context={context}
          onCancel={(allow) => {
            if (allow) router.replace(hrefFor({}));
          }}
          onDone={(receipt) =>
            router.replace(opportunitiesHref(workspace.slug, { stage: "all", opportunity: receipt.id }))
          }
        />
      )}
    </section>
  );
}

function OpportunityDirectory({
  workspace,
  context,
  stage,
  query,
  requestedId,
  counts,
  hrefFor,
}: {
  workspace: FunctionReturnType<typeof api.workspaces.index.list>[number];
  context: FunctionReturnType<typeof api.commercial.opportunities.get>;
  stage: TStageFilter;
  query: string;
  requestedId: string | null;
  counts: ReturnType<typeof stageCounts> | null;
  hrefFor: (next: Parameters<typeof opportunitiesHref>[1]) => string;
}) {
  const router = useRouter();
  const directory = usePaginatedQuery(
    api.commercial.opportunities.list,
    {
      workspaceId: workspace._id,
      search: query,
      stage: stage === "all" ? null : stage,
    },
    { initialNumItems: 20 }
  );
  const groups = groupByStage(directory.results);
  const selected = groups[0]?.items[0];
  const explicit = Boolean(requestedId);
  const detailId = requestedId || selected?._id;
  const detail = useQuery(
    api.commercial.opportunities.get,
    detailId ? { workspaceId: workspace._id, opportunityId: detailId, clientId: null } : "skip"
  );
  return (
    <div className="@container">
      <div className="grid overflow-hidden rounded-2xl bg-surface-1 shadow-[0_1px_2px_rgba(15,23,42,0.06),0_8px_24px_-12px_rgba(15,23,42,0.12)] ring-1 ring-subtle @3xl:h-[calc(100dvh-15.5rem)] @3xl:min-h-[34rem] @3xl:grid-cols-[minmax(17rem,20rem)_minmax(0,1fr)] @5xl:grid-cols-[23rem_minmax(0,1fr)]">
        <div
          className={`min-h-0 flex-col border-subtle @3xl:flex @3xl:border-r ${explicit ? "hidden" : "flex"}`}
          aria-label="Opportunity results"
          role="region"
        >
          {directory.status === "LoadingFirstPage" && (
            <div className="p-4">
              <SummonRequestState loading />
            </div>
          )}
          {directory.status === "Exhausted" && directory.results.length === 0 && (
            <div className="grid gap-3 p-6 text-center">
              <p className="text-13 font-medium text-primary">No opportunities match</p>
              <p className="text-12 text-secondary">{query ? `Nothing matches “${query}”` : "This stage is empty"}.</p>
              <Button
                size="xl"
                variant="secondary"
                onClick={() => router.replace(hrefFor({ stage: "all", search: "", opportunity: null }))}
              >
                Clear filters
              </Button>
            </div>
          )}
          <div className="vertical-scrollbar min-h-0 flex-1 overflow-y-auto">
            {groups.map((group) => (
              <section key={group.stage} aria-label={OPPORTUNITY_STAGE_LABEL[group.stage]}>
                <h2 className="sticky top-0 z-10 flex h-9 items-center gap-2 border-b border-subtle bg-layer-1/95 px-4 text-11 font-semibold text-secondary backdrop-blur">
                  <span aria-hidden className={`size-2 rounded-full ${OPPORTUNITY_STAGE_TONE[group.stage].dot}`} />
                  {OPPORTUNITY_STAGE_LABEL[group.stage]}
                  <span className="font-normal text-tertiary tabular-nums">{counts?.get(group.stage) ?? "—"}</span>
                </h2>
                <ul>
                  {group.items.map((opportunity) => (
                    <OpportunityRow
                      key={opportunity._id}
                      opportunity={opportunity}
                      clientName={opportunity.clientName}
                      href={hrefFor({ opportunity: opportunity._id })}
                      selected={detailId === opportunity._id}
                      currency={context.currency}
                    />
                  ))}
                </ul>
              </section>
            ))}
            {directory.status === "CanLoadMore" && (
              <Button className="m-4" variant="secondary" onClick={() => directory.loadMore(20)}>
                Load more opportunities
              </Button>
            )}
            {directory.status === "LoadingMore" && (
              <p role="status" className="p-4 text-12 text-secondary">
                Loading opportunities…
              </p>
            )}
          </div>
        </div>
        <div
          className={`vertical-scrollbar min-h-0 overflow-y-auto bg-layer-1/25 p-4 lg:p-5 @3xl:block ${explicit ? "block" : "hidden"}`}
        >
          {detail ? (
            <OpportunityInspector
              key={detail.record?._id}
              workspace={workspace}
              context={detail}
              backHref={hrefFor({ opportunity: null })}
              backClassName="@3xl:hidden"
            />
          ) : (
            <SummonRequestState
              loading={Boolean(detailId)}
              empty={!detailId}
              emptyMessage="No opportunity to show for these filters."
            />
          )}
        </div>
      </div>
    </div>
  );
}

function StageFilter(props: {
  stage: TStageFilter;
  total: number | null;
  counts: Map<Doc<"opportunities">["stage"], number> | null;
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
            count={counts?.get(item) ?? null}
            dot={OPPORTUNITY_STAGE_TONE[item].dot}
          />
        ))}
      </div>
      {total ? (
        <div aria-hidden className="flex h-1.5 gap-0.5 overflow-hidden rounded-full bg-layer-2">
          {OPPORTUNITY_STAGES.map((item) =>
            counts?.get(item) ? (
              <span
                key={item}
                className={`h-full transition-[flex-grow,opacity] duration-300 motion-reduce:transition-none ${OPPORTUNITY_STAGE_TONE[item].bar} ${stage === "all" || stage === item ? "opacity-100" : "opacity-30"}`}
                style={{ flexGrow: counts?.get(item) }}
              />
            ) : null
          )}
        </div>
      ) : null}
    </div>
  );
}

function FilterChip(props: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number | null;
  dot?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={props.active}
      onClick={props.onClick}
      className={`inline-flex h-10 flex-none items-center gap-2 rounded-lg px-3 text-12 font-medium transition-[background-color,color,scale] duration-150 focus-visible:outline-2 focus-visible:outline-accent-strong active:scale-[0.96] motion-reduce:transition-none ${props.active ? "bg-layer-3 text-primary ring-1 ring-strong" : "text-secondary hover:bg-layer-2 hover:text-primary"}`}
    >
      {props.dot ? <span aria-hidden className={`size-2 rounded-full ${props.dot}`} /> : null}
      {props.label}
      <span className={`tabular-nums ${props.active ? "text-secondary" : "text-tertiary"}`}>{props.count ?? "—"}</span>
    </button>
  );
}

function OpportunityRow(props: {
  opportunity: FunctionReturnType<typeof api.commercial.opportunities.list>["page"][number];
  clientName?: string;
  href: string;
  selected: boolean;
  currency: string;
}) {
  const { opportunity } = props;
  const owner = opportunity.owner ? memberLabel(opportunity.owner) : undefined;
  const closeDate = formatShortDate(opportunity.expectedCloseDate);
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
            {opportunity.value === null ? "—" : opportunityMoney(props.currency, opportunity.value)}
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
