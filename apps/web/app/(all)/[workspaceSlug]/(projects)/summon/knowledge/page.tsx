/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { NoteIcon, SquaresFourIcon } from "@phosphor-icons/react";
import useSWR from "swr";
import {
  ArrowUpRight,
  BriefcaseBusiness,
  Check,
  ChevronDown,
  FileText,
  FolderKanban,
  Layers,
  Link2,
  MessageSquareText,
  Plus,
  Sparkles,
  Upload,
  Users,
} from "lucide-react";
import { EPageAccess } from "@plane/constants";
import { Button, getButtonStyling } from "@plane/propel/button";
import { MenuPrimitive as Menu } from "@plane/propel/menu";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import { cn } from "@plane/utils";
import {
  OPTION_POPUP_CLASSNAME,
  OptionItem,
  OptionMenuScope,
  OptionPopup,
  OptionSubmenu,
} from "@/components/summon/option-menu";
import { SummonRequestState } from "@/components/summon/request-state";
import {
  SummonMetric,
  SummonMetricStrip,
  SummonPagination,
  SummonScreen,
  SummonSectionHeader,
  SummonTableShell,
  summonErrorMessage,
  summonSurfaceClassName,
} from "@/components/summon/screen";
import { SummonSearchField } from "@/components/summon/search-field";
import { SectionTabs } from "@/components/summon/section-tabs";
import type { TSectionTab } from "@/components/summon/section-tabs";
import { useSummonAccess } from "@/components/summon/use-summon-access";
import { useMember } from "@/hooks/store/use-member";
import { useProject } from "@/hooks/store/use-project";
import { ProjectPageService } from "@/services/page";
import { listAccessiblePlanePages } from "@/services/summon-plane.service";
import { summonService } from "@/services/summon.service";
import type { Route } from "./+types/page";
import {
  ALL_CATEGORIES,
  PAGE_SIZE,
  askHref,
  categoryLabel,
  contextOptionsFor,
  filterKnowledge,
  knowledgeCategories,
  knowledgeEntries,
  knowledgeStats,
  pageHref,
  starterQuestions,
  uniqueOptions,
  updatedTime,
} from "./knowledge-model";
import type { TKnowledgeContextFilter, TKnowledgeContextOptions, TKnowledgeEntry } from "./knowledge-model";

const pageService = new ProjectPageService();
const RECENT_COUNT = 4;
const CHIP_CLASSNAME = cn(getButtonStyling("secondary", "base"), "max-w-full min-w-0");

const formatDate = (entry: TKnowledgeEntry) => {
  const time = updatedTime(entry);
  return time ? new Intl.DateTimeFormat("en", { day: "numeric", month: "short", year: "numeric" }).format(time) : "—";
};

export default function SummonKnowledgePage({ params }: Route.ComponentProps) {
  const { workspaceSlug } = params;
  const { can } = useSummonAccess(workspaceSlug);
  const showOpportunities = can("commercial.view");
  const [query, setQuery] = useState("");

  const {
    data: pages = [],
    error,
    isLoading,
    mutate,
  } = useSWR(["summon-plane-pages", workspaceSlug], () => listAccessiblePlanePages(workspaceSlug));
  const { data: contexts = [] } = useSWR(["summon-knowledge-contexts", workspaceSlug], () =>
    summonService.listPageContexts(workspaceSlug)
  );
  const { data: clients = [] } = useSWR(["summon-clients", workspaceSlug], () =>
    summonService.listClients(workspaceSlug)
  );
  // Deals are commercial records: only people who may see them fetch them.
  const { data: opportunities = [] } = useSWR(showOpportunities ? ["summon-opportunities", workspaceSlug] : null, () =>
    summonService.listOpportunities(workspaceSlug)
  );

  const entries = useMemo(() => knowledgeEntries(pages, contexts), [contexts, pages]);
  const searching = Boolean(query.trim());

  return (
    <SummonScreen
      title="Knowledge"
      description="Pages and notes from the projects you can access, and answers drawn from them."
      actions={
        <>
          <Link href={`/${workspaceSlug}/summon/resources/`} className={getButtonStyling("secondary", "lg")}>
            <Link2 aria-hidden />
            Add link
          </Link>
          <Link href={`/${workspaceSlug}/summon/documents/`} className={getButtonStyling("secondary", "lg")}>
            <Upload aria-hidden />
            Upload
          </Link>
          <NewPageMenu workspaceSlug={workspaceSlug} />
        </>
      }
    >
      <div className="flex flex-col gap-6">
        <FindOrAsk workspaceSlug={workspaceSlug} query={query} onQueryChange={setQuery} entries={entries} />
        {searching ? null : <KnowledgeOverview workspaceSlug={workspaceSlug} entries={entries} />}
        <KnowledgeLibrary
          workspaceSlug={workspaceSlug}
          entries={entries}
          query={query}
          contextOptions={contextOptionsFor(entries, clients, showOpportunities ? opportunities : [])}
          loading={isLoading}
          error={error}
          onRetry={() => void mutate()}
        />
      </div>
    </SummonScreen>
  );
}

/** One field that finds pages as you type and hands the same words to the Assistant. */
function FindOrAsk(props: {
  workspaceSlug: string;
  query: string;
  onQueryChange: (query: string) => void;
  entries: TKnowledgeEntry[];
}) {
  const searching = Boolean(props.query.trim());
  return (
    <section aria-label="Find or ask" className="flex max-w-3xl flex-col gap-3">
      <div className="flex gap-2">
        <SummonSearchField
          label="Find or ask about knowledge"
          placeholder="Find a page, or ask Summon a question…"
          value={props.query}
          onValueChange={props.onQueryChange}
          className="flex-1"
        />
        <Link
          href={searching ? askHref(props.workspaceSlug, props.query) : `/${props.workspaceSlug}/summon/assistant/`}
          className={getButtonStyling("primary", "lg")}
        >
          <Sparkles aria-hidden />
          Ask<span className="max-sm:sr-only"> Summon</span>
        </Link>
      </div>
      {searching ? null : (
        <ul className="flex flex-wrap gap-2" aria-label="Suggested questions">
          {starterQuestions(props.entries).map((question) => (
            <li key={question} className="min-w-0">
              <Link
                href={askHref(props.workspaceSlug, question)}
                className={cn(getButtonStyling("secondary", "sm"), "max-w-full rounded-full text-secondary")}
              >
                <MessageSquareText aria-hidden />
                <span className="truncate">{question}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Real counts, then the pages touched last — the latter only when the library alone would bury them. */
function KnowledgeOverview({ workspaceSlug, entries }: { workspaceSlug: string; entries: TKnowledgeEntry[] }) {
  if (!entries.length) return null;
  const stats = knowledgeStats(entries, Date.now());
  return (
    <>
      <SummonMetricStrip>
        <SummonMetric label="Pages" value={stats.pages} />
        <SummonMetric label="Projects" value={stats.projects} />
        <SummonMetric label="Updated this week" value={stats.updatedThisWeek} />
        <SummonMetric label="Contributors" value={stats.contributors} />
      </SummonMetricStrip>
      {entries.length > RECENT_COUNT ? (
        <section>
          <SummonSectionHeader title="Jump back in" className="mb-3" />
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {entries.slice(0, RECENT_COUNT).map((entry) => (
              <li key={entry.page.id} className="min-w-0">
                <Link
                  href={pageHref(workspaceSlug, entry)}
                  className={cn(
                    summonSurfaceClassName,
                    "flex h-full flex-col gap-3 p-3.5 transition-colors hover:bg-layer-1"
                  )}
                >
                  <span className="grid size-8 place-items-center rounded-lg bg-layer-2 text-secondary">
                    <FileText aria-hidden className="size-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="line-clamp-2 text-13 font-medium text-primary">
                      {entry.page.name || "Untitled page"}
                    </span>
                    <span className="mt-1 flex items-center gap-1.5 text-12 text-tertiary">
                      <span className="truncate">{entry.project.name}</span>
                      <span aria-hidden>·</span>
                      <span className="flex-none">{formatDate(entry)}</span>
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}

/** Every accessible page, newest first, narrowed by search, category and context, ten at a time. */
function KnowledgeLibrary(props: {
  workspaceSlug: string;
  entries: TKnowledgeEntry[];
  query: string;
  contextOptions: TKnowledgeContextOptions;
  loading: boolean;
  error: unknown;
  onRetry: () => void;
}) {
  const [category, setCategory] = useState(ALL_CATEGORIES);
  const [contextFilter, setContextFilter] = useState<TKnowledgeContextFilter>("all");
  const [page, setPage] = useState(1);
  const categories = knowledgeCategories(props.entries);
  const filtered = filterKnowledge(props.entries, { query: props.query, category, context: contextFilter });
  const currentPage = Math.min(page, Math.max(1, Math.ceil(filtered.length / PAGE_SIZE)));
  const searching = Boolean(props.query.trim());
  const narrowed = searching || category !== ALL_CATEGORIES || contextFilter !== "all";
  const categoryTabs: TSectionTab<string>[] = [
    { value: ALL_CATEGORIES, label: "All", icon: SquaresFourIcon },
    ...categories.map((value) => ({ value, label: categoryLabel(value), icon: NoteIcon })),
  ];

  return (
    <section>
      <SummonSectionHeader title="Library" count={filtered.length} className="mb-3" />
      <SummonTableShell
        filters={
          <div className="flex flex-wrap items-center justify-between gap-2">
            {categories.length ? (
              <SectionTabs
                items={categoryTabs}
                value={category}
                onValueChange={(value) => {
                  setCategory(value);
                  setPage(1);
                }}
                label="Knowledge categories"
              />
            ) : (
              <span className="text-12 text-tertiary">Most recently updated first</span>
            )}
            <ContextFilter
              value={contextFilter}
              options={props.contextOptions}
              onChange={(value) => {
                setContextFilter(value);
                setPage(1);
              }}
            />
          </div>
        }
      >
        {searching ? (
          <Link
            href={askHref(props.workspaceSlug, props.query)}
            className="flex items-center gap-3 border-b border-subtle px-3.5 py-2.5 text-13 text-primary hover:bg-layer-1"
          >
            <span className="grid size-7 flex-none place-items-center rounded-md bg-accent-subtle text-accent-primary">
              <Sparkles aria-hidden className="size-3.5" />
            </span>
            <span className="min-w-0 flex-1 truncate">
              Ask Summon about <q className="font-medium">{props.query.trim()}</q>
            </span>
            <ArrowUpRight aria-hidden className="size-4 flex-none text-tertiary" />
          </Link>
        ) : null}
        <div className="px-3.5">
          <SummonRequestState
            loading={props.loading}
            error={props.error}
            empty={!props.loading && !filtered.length}
            emptyAsset="knowledge"
            emptyTitle={narrowed ? "No pages match" : "No knowledge yet"}
            emptyMessage={
              narrowed
                ? "Try another word or context, or ask Summon instead."
                : "Pages you can access in your projects show up here."
            }
            onRetry={props.onRetry}
          />
        </div>
        <LibraryTable
          workspaceSlug={props.workspaceSlug}
          entries={filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)}
          showCategory={categories.length > 0}
        />
        <SummonPagination
          page={currentPage}
          pageSize={PAGE_SIZE}
          total={filtered.length}
          noun="pages"
          onPageChange={setPage}
        />
      </SummonTableShell>
    </section>
  );
}

/** Title and date always; project, category and editor join as the width allows. */
function LibraryTable(props: { workspaceSlug: string; entries: TKnowledgeEntry[]; showCategory: boolean }) {
  const { getUserDetails } = useMember();
  if (!props.entries.length) return null;
  return (
    <table className="w-full table-fixed text-left text-13">
      <thead className="border-b border-subtle text-12 text-tertiary">
        <tr>
          <th className="px-3.5 py-2.5 font-medium">Title</th>
          <th className="hidden w-48 px-3.5 py-2.5 font-medium md:table-cell">Project</th>
          {props.showCategory ? (
            <th className="hidden w-36 px-3.5 py-2.5 font-medium lg:table-cell">Category</th>
          ) : null}
          <th className="w-28 px-3.5 py-2.5 font-medium">Updated</th>
          <th className="hidden w-40 px-3.5 py-2.5 font-medium lg:table-cell">Updated by</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-subtle">
        {props.entries.map((entry) => (
          <tr key={entry.page.id} className="hover:bg-layer-1">
            <td className="px-3.5 py-2.5">
              <Link href={pageHref(props.workspaceSlug, entry)} className="flex min-w-0 items-center gap-2">
                <FileText aria-hidden className="size-4 flex-none text-tertiary" />
                <span className="min-w-0">
                  <span className="block truncate font-medium text-primary">{entry.page.name || "Untitled page"}</span>
                  <span className="block truncate text-12 text-tertiary md:hidden">{entry.project.name}</span>
                </span>
              </Link>
            </td>
            <td className="hidden truncate px-3.5 py-2.5 text-secondary md:table-cell">{entry.project.name}</td>
            {props.showCategory ? (
              <td className="hidden px-3.5 py-2.5 text-secondary lg:table-cell">
                {categoryLabel(entry.context?.category)}
              </td>
            ) : null}
            <td className="px-3.5 py-2.5 text-secondary tabular-nums">{formatDate(entry)}</td>
            <td className="hidden truncate px-3.5 py-2.5 text-secondary lg:table-cell">
              {(entry.page.updated_by && getUserDetails(entry.page.updated_by)?.display_name) || "—"}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

const CONTEXT_GROUPS = [
  { kind: "project", label: "Project", icon: FolderKanban },
  { kind: "client", label: "Client", icon: Users },
  { kind: "opportunity", label: "Opportunity", icon: BriefcaseBusiness },
] as const;

/** Narrow the library to one project, client or (for people who may see deals) opportunity. */
function ContextFilter(props: {
  value: TKnowledgeContextFilter;
  options: TKnowledgeContextOptions;
  onChange: (value: TKnowledgeContextFilter) => void;
}) {
  const [kind, id] = props.value.split(":");
  const group = CONTEXT_GROUPS.find((item) => item.kind === kind);
  const selected = group ? props.options[group.kind].find((option) => option.id === id) : undefined;
  const Icon = group?.icon ?? Layers;
  return (
    <Menu.Root>
      <Menu.Trigger className={CHIP_CLASSNAME} aria-label={`Context: ${selected?.label ?? "All contexts"}. Change`}>
        <Icon aria-hidden />
        <span className="max-w-48 truncate">{selected?.label ?? "All contexts"}</span>
        <ChevronDown aria-hidden />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner side="bottom" align="end" sideOffset={4} className="z-[120]">
          <Menu.Popup className={OPTION_POPUP_CLASSNAME}>
            <OptionItem
              label="All contexts"
              icon={<Layers aria-hidden className="size-4 text-secondary" />}
              selected={props.value === "all"}
              onClick={() => props.onChange("all")}
            />
            {CONTEXT_GROUPS.filter((item) => props.options[item.kind].length).map((item) => (
              <OptionSubmenu
                key={item.kind}
                icon={item.icon}
                label={item.label}
                options={props.options[item.kind]}
                trailing={kind === item.kind ? <Check aria-hidden className="size-4 text-accent-primary" /> : null}
                isChecked={(optionId) => kind === item.kind && optionId === id}
                onPick={(optionId) => props.onChange(`${item.kind}:${optionId}`)}
              />
            ))}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}

/** Pick the project, create an empty page there and open it. */
function NewPageMenu({ workspaceSlug }: { workspaceSlug: string }) {
  const router = useRouter();
  const { joinedProjectIds, getProjectById } = useProject();
  const [creating, setCreating] = useState(false);
  const projects = uniqueOptions(joinedProjectIds.map((id) => ({ id, label: getProjectById(id)?.name ?? id })));

  const create = async (projectId: string) => {
    setCreating(true);
    try {
      const created = await pageService.create(workspaceSlug, projectId, { name: "", access: EPageAccess.PUBLIC });
      router.push(`/${workspaceSlug}/projects/${projectId}/pages/${created.id}/`);
    } catch (error) {
      setToast({ type: TOAST_TYPE.ERROR, title: "Couldn't create the page", message: summonErrorMessage(error) });
      setCreating(false);
    }
  };

  return (
    <OptionMenuScope options={projects}>
      <Menu.Root>
        <Menu.Trigger
          render={<Button size="lg" loading={creating} disabled={!projects.length || creating} />}
          aria-label="New page. Choose a project"
        >
          <Plus aria-hidden />
          New page
        </Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner side="bottom" align="end" sideOffset={4} className="z-[120]">
            <OptionPopup
              label="Choose a project"
              options={projects}
              isChecked={() => false}
              onPick={(projectId) => void create(projectId)}
            />
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
    </OptionMenuScope>
  );
}
