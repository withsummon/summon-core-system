/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  CompassIcon,
  FileTextIcon,
  LightbulbIcon,
  NoteIcon,
  QuestionIcon,
  SquaresFourIcon,
} from "@phosphor-icons/react";
import useSWR from "swr";
import {
  BookOpen,
  BriefcaseBusiness,
  Building2,
  ChevronRight,
  FileText,
  FolderKanban,
  Link2,
  Send,
  Sparkles,
  Upload,
  Users,
} from "lucide-react";
import { EmptyStateCompact } from "@plane/propel/empty-state";
import type { CompactAssetType } from "@plane/propel/empty-state";
import { PageHead } from "@/components/core/page-title";
import {
  SummonCard,
  SummonPageHeader,
  SummonPanel,
  SummonSectionHeader,
  SummonTableShell,
  summonPageClassName,
  ViewPanel,
} from "@/components/summon/screen";
import { SummonRequestState } from "@/components/summon/request-state";
import { SectionTabs } from "@/components/summon/section-tabs";
import type { TSectionTab } from "@/components/summon/section-tabs";
import { useHashTab } from "@/components/summon/use-hash-tab";
import { useMember } from "@/hooks/store/use-member";
import { listAccessiblePlanePages } from "@/services/summon-plane.service";
import { summonService } from "@/services/summon.service";
import type { Route } from "./+types/page";
import { SummonSearchField } from "@/components/summon/search-field";

const KNOWLEDGE_TABS: TSectionTab<string>[] = [
  { value: "all", label: "All", icon: SquaresFourIcon },
  { value: "notes", label: "Notes", icon: NoteIcon },
  { value: "documents", label: "Documents", icon: FileTextIcon },
  { value: "guides", label: "Guides", icon: CompassIcon },
  { value: "faqs", label: "FAQs", icon: QuestionIcon },
  { value: "lessons-learned", label: "Lessons Learned", icon: LightbulbIcon },
];

const formatDate = (value?: Date) => {
  if (!value) return "Unknown";
  return new Intl.DateTimeFormat("en", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value));
};

export default function SummonKnowledgePage({ params }: Route.ComponentProps) {
  const { workspaceSlug } = params;
  const { getUserDetails } = useMember();
  const [query, setQuery] = useState("");
  const [tab, setTab] = useHashTab(KNOWLEDGE_TABS.map((item) => item.value));
  const {
    data: pages = [],
    error,
    isLoading,
    mutate,
  } = useSWR(["summon-knowledge-pages", workspaceSlug], () => listAccessiblePlanePages(workspaceSlug));
  const { data: contexts = [] } = useSWR(["summon-knowledge-contexts", workspaceSlug], () =>
    summonService.listPageContexts(workspaceSlug)
  );
  const { data: home } = useSWR(["summon-knowledge-home", workspaceSlug], () =>
    summonService.getHomeSummary(workspaceSlug)
  );

  const contextByPage = useMemo(() => new Map(contexts.map((context) => [context.page, context])), [contexts]);
  const normalizedQuery = query.trim().toLowerCase();
  const filteredPages = useMemo(
    () =>
      pages.filter(({ page, project }) => {
        const context = page.id ? contextByPage.get(page.id) : undefined;
        const matchesQuery = `${page.name || ""} ${project.name} ${context?.category || ""}`
          .toLowerCase()
          .includes(normalizedQuery);
        if (!matchesQuery || tab === "all") return matchesQuery;
        if (tab === "documents") return context?.category === "document" || !context?.category;
        return context?.category?.toLowerCase() === tab.replace("-", "_");
      }),
    [contextByPage, normalizedQuery, pages, tab]
  );
  const recentPages = useMemo(() => {
    // oxlint-disable-next-line unicorn/no-array-sort -- ES2023 toSorted is unavailable in the app's current TypeScript target.
    return [...pages].sort(
      (left, right) =>
        (Date.parse(String(right.page.updated_at ?? "")) || 0) - (Date.parse(String(left.page.updated_at ?? "")) || 0)
    );
  }, [pages]);
  const uniqueContributors = new Set(pages.flatMap(({ page }) => [page.created_by, page.updated_by]).filter(Boolean));
  const contextCards = [
    {
      label: "Projects",
      count: new Set(pages.map(({ project }) => project.id)).size,
      icon: FolderKanban,
      detail: "Project pages and delivery knowledge",
    },
    {
      label: "Clients",
      count: contexts.filter((item) => item.client).length,
      icon: Users,
      detail: "Client-linked notes and requirements",
    },
    {
      label: "Opportunities",
      count: contexts.filter((item) => item.opportunity).length,
      icon: BriefcaseBusiness,
      detail: "Commercial and proposal knowledge",
    },
    {
      label: "Processes",
      count: contexts.filter((item) => item.category === "process").length,
      icon: BookOpen,
      detail: "Procedures and team workflows",
    },
    {
      label: "Company",
      count: contexts.filter((item) => !item.project && !item.client && !item.opportunity).length,
      icon: Building2,
      detail: "Workspace-wide knowledge",
    },
  ];
  const firstProject = home?.projects[0];

  return (
    <div className={summonPageClassName}>
      <PageHead title="Knowledge · Summon Core" />
      <SummonPageHeader title="Knowledge" description="Company knowledge, notes and insights in one place" />

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <main className="min-w-0 space-y-5">
          <SummonSearchField
            label="Search knowledge"
            placeholder="Search knowledge, notes, topics, or ask anything…"
            value={query}
            onValueChange={setQuery}
            className="max-w-3xl"
          />

          <section className="rounded-xl border border-accent-subtle bg-accent-subtle/50 p-4">
            <div className="flex items-center gap-3">
              <span className="grid size-12 place-items-center rounded-xl bg-accent-primary text-white">
                <Sparkles className="size-6" />
              </span>
              <div>
                <h2 className="text-sm font-semibold text-primary">Ask Summon Assistant anything</h2>
                <p className="mt-1 text-xs text-secondary">
                  Get answers from accessible workspace, project, and Plane Page context.
                </p>
              </div>
            </div>
            <Link
              href={`/${workspaceSlug}/summon/assistant/`}
              className="mt-5 flex h-12 items-center gap-3 rounded-xl border border-subtle bg-surface-1 px-4 text-xs text-secondary shadow-xs"
            >
              <span className="flex-1">Ask a question about projects, clients, processes, or anything…</span>
              <Send className="size-4" />
            </Link>
            <div className="mt-3 flex flex-wrap gap-2">
              {["Summarize a project", "Find recent meeting notes", "Show deployment knowledge"].map((prompt) => (
                <Link
                  key={prompt}
                  href={`/${workspaceSlug}/summon/assistant/`}
                  className="rounded-full border border-subtle bg-surface-1 px-3 py-2 text-12 text-secondary"
                >
                  {prompt}
                </Link>
              ))}
            </div>
          </section>

          <section>
            <SummonSectionHeader title="Browse by Context" className="mb-3" />
            <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-5">
              {contextCards.map(({ label, count, icon: Icon, detail }) => (
                <SummonCard key={label}>
                  <div className="flex items-center justify-between">
                    <span className="grid size-8 place-items-center rounded-lg bg-accent-subtle text-accent-primary">
                      <Icon className="size-4" />
                    </span>
                    <span className="rounded-full bg-layer-1 px-2 py-1 text-12 text-secondary">{count}</span>
                  </div>
                  <h3 className="mt-4 text-13 font-medium text-primary">{label}</h3>
                  <p className="mt-1 text-12 leading-relaxed text-secondary">{detail}</p>
                </SummonCard>
              ))}
            </div>
          </section>

          <section>
            <SummonSectionHeader title="Recent Knowledge" count={filteredPages.length} />
            <SectionTabs
              items={KNOWLEDGE_TABS}
              value={tab}
              onValueChange={setTab}
              label="Knowledge categories"
              className="mt-2"
            />
            <ViewPanel value={tab}>
              <SummonRequestState
                loading={isLoading}
                error={error}
                empty={!isLoading && filteredPages.length === 0}
                emptyAsset="knowledge"
                emptyTitle="No knowledge here yet"
                emptyMessage="Pages you can access in this category show up here."
                onRetry={() => void mutate()}
              />
              {!!filteredPages.length && (
                <SummonTableShell className="mt-3">
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[46rem] text-left text-xs">
                      <thead className="border-b border-subtle bg-layer-1 text-12 text-tertiary">
                        <tr>
                          <th className="px-4 py-3 font-medium">Title</th>
                          <th className="px-4 py-3 font-medium">Context</th>
                          <th className="px-4 py-3 font-medium">Type</th>
                          <th className="px-4 py-3 font-medium">Updated</th>
                          <th className="px-4 py-3 font-medium">Updated by</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-subtle">
                        {filteredPages.slice(0, 8).map(({ page, project }) => {
                          const context = page.id ? contextByPage.get(page.id) : undefined;
                          const actor = page.updated_by ? getUserDetails(page.updated_by) : undefined;
                          return (
                            <tr key={page.id} className="hover:bg-layer-1">
                              <td className="px-4 py-3">
                                <Link
                                  href={`/${workspaceSlug}/projects/${project.id}/pages/${page.id}/`}
                                  className="flex items-center gap-2 font-medium text-primary"
                                >
                                  <FileText className="size-4 shrink-0 text-accent-primary" />
                                  <span className="max-w-64 truncate">{page.name || "Untitled Page"}</span>
                                </Link>
                              </td>
                              <td className="px-4 py-3 text-secondary">{project.name}</td>
                              <td className="px-4 py-3">
                                <span className="rounded-full bg-accent-subtle px-2 py-1 text-12 text-accent-primary">
                                  {context?.category || "Page"}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-secondary">{formatDate(page.updated_at)}</td>
                              <td className="px-4 py-3 text-secondary">{actor?.display_name || "Unknown"}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </SummonTableShell>
              )}
            </ViewPanel>
          </section>
        </main>

        <aside className="space-y-4">
          <SummonPanel title="Quick Actions">
            <div className="space-y-1">
              <QuickAction
                icon={FileText}
                label="Create New Note"
                href={
                  firstProject
                    ? `/${workspaceSlug}/projects/${firstProject.id}/pages/`
                    : `/${workspaceSlug}/summon/projects/`
                }
              />
              <QuickAction icon={Upload} label="Upload Document" href={`/${workspaceSlug}/summon/documents/`} />
              <QuickAction
                icon={Link2}
                label="Create Knowledge from URL"
                href={`/${workspaceSlug}/summon/resources/`}
              />
              <QuickAction icon={Sparkles} label="Ask Summon Assistant" href={`/${workspaceSlug}/summon/assistant/`} />
            </div>
          </SummonPanel>
          <SummonPanel title="Recent Notes" link={{ href: `/${workspaceSlug}/summon/documents/`, label: "View all" }}>
            <div className="space-y-3">
              {recentPages.slice(0, 5).map(({ page, project }) => (
                <Link
                  key={page.id}
                  href={`/${workspaceSlug}/projects/${project.id}/pages/${page.id}/`}
                  className="flex gap-2"
                >
                  <FileText className="mt-0.5 size-4 shrink-0 text-accent-primary" />
                  <span className="min-w-0">
                    <strong className="block truncate text-12 font-medium text-primary">
                      {page.name || "Untitled Page"}
                    </strong>
                    <small className="text-12 text-secondary">{formatDate(page.updated_at)}</small>
                  </span>
                </Link>
              ))}
              {!recentPages.length && <Empty asset="note" text="No accessible notes." />}
            </div>
          </SummonPanel>
          <SummonPanel title="Knowledge Stats">
            <div className="grid grid-cols-2 gap-2">
              <Stat label="Total Pages" value={String(pages.length)} />
              <Stat label="Projects" value={String(new Set(pages.map(({ project }) => project.id)).size)} />
              <Stat label="Contributors" value={String(uniqueContributors.size)} />
            </div>
          </SummonPanel>
        </aside>
      </div>
    </div>
  );
}

function QuickAction({ icon: Icon, label, href }: { icon: typeof FileText; label: string; href: string }) {
  return (
    <Link href={href} className="flex items-center gap-3 rounded-lg px-2 py-2.5 text-12 text-primary hover:bg-layer-1">
      <Icon className="size-4 text-accent-primary" />
      <span className="flex-1">{label}</span>
      <ChevronRight className="size-3.5 text-tertiary" />
    </Link>
  );
}
function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-subtle p-3">
      <p className="text-12 text-tertiary">{label}</p>
      <p className="mt-1 truncate text-sm font-semibold text-primary">{value}</p>
    </div>
  );
}
function Empty({ text, asset }: { text: string; asset: CompactAssetType }) {
  return <EmptyStateCompact assetKey={asset} assetClassName="size-20" title={text} rootClassName="py-4" />;
}
