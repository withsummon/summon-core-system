/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { useEffect, useState } from "react";
import { useOutletContext } from "react-router";
import { useQuery } from "convex/react";
import { usePaginatedQuery } from "convex-helpers/react";
import { api } from "@summon/convex/api";
import type { WorkspaceSession } from "@/components/workspace/native-shell/session";
import { PreservedWorkspaceShell } from "@/components/workspace/native-shell/workspace-shell";
import { useStickiesCommands } from "@/components/stickies/native/provider";
import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  BriefcaseBusiness,
  Building2,
  ChevronRight,
  FileText,
  FolderKanban,
  Link2,
  Search,
  Send,
  Sparkles,
  Upload,
  Users,
} from "lucide-react";
import { SummonRequestState } from "@/components/summon/request-state";

const formatDate = (value?: number) => {
  if (!value) return "Unknown";
  return new Intl.DateTimeFormat("en", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value));
};

export default function SummonKnowledgePage() {
  const session = useOutletContext<WorkspaceSession>();
  const commands = useStickiesCommands();
  return (
    <PreservedWorkspaceShell
      {...session}
      onCreateSticky={commands.create}
      onOpenStickies={commands.openAll}
      beforeLeave={commands.flushAll}
    >
      <Knowledge workspaceSlug={session.workspace.slug} />
    </PreservedWorkspaceShell>
  );
}
function Knowledge({ workspaceSlug }: { workspaceSlug: string }) {
  const { workspace } = useOutletContext<WorkspaceSession>();
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState("All");
  const availableProjects = useQuery(api.projects.index.list, { workspaceId: workspace._id });
  const {
    results: filteredPages,
    status,
    loadMore,
  } = usePaginatedQuery(
    api.documents.index.list,
    {
      workspaceId: workspace._id,
      contextualSearch: true,
      search: query,
      category: tab === "All" ? undefined : tab === "Documents" ? "document" : tab.toLowerCase().replaceAll(" ", "_"),
      sortKey: "updated_at",
      sortBy: "desc",
    },
    { initialNumItems: 50 }
  );
  const summary = usePaginatedQuery(
    api.documents.index.list,
    { workspaceId: workspace._id, sortKey: "updated_at", sortBy: "desc" },
    { initialNumItems: 100 }
  );
  const { status: summaryStatus, loadMore: loadSummary } = summary;
  useEffect(() => {
    if (summaryStatus === "CanLoadMore") loadSummary(100);
  }, [summaryStatus, loadSummary]);
  const pages = summary.results;
  const contexts = pages.map(({ document }) => document);
  const isLoading = status === "LoadingFirstPage";
  const recentPages = pages;
  const uniqueContributors = new Set(pages.flatMap(({ document }) => [document.ownedBy, document.updatedBy]));
  const contextCards = [
    {
      label: "Projects",
      count: new Set(pages.flatMap(({ projects }) => projects.map((project) => project.id))).size,
      icon: FolderKanban,
      detail: "Project pages and delivery knowledge",
    },
    {
      label: "Clients",
      count: contexts.filter((item) => item.clientId).length,
      icon: Users,
      detail: "Client-linked notes and requirements",
    },
    {
      label: "Opportunities",
      count: contexts.filter((item) => item.opportunityId).length,
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
      count: contexts.filter((item) => !item.projectIds.length && !item.clientId && !item.opportunityId).length,
      icon: Building2,
      detail: "Workspace-wide knowledge",
    },
  ];
  const firstProject = availableProjects?.[0];

  return (
    <div className="mx-auto min-h-full w-full max-w-[1600px] bg-surface-1 p-4 lg:p-5">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-primary">Knowledge</h1>
        <p className="text-xs mt-1 text-secondary">Your company knowledge, notes, and insights in one place</p>
      </header>

      <div className="mt-5 grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <main className="min-w-0 space-y-5">
          <label className="relative block max-w-3xl">
            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-tertiary" />
            <input
              value={query}
              maxLength={255}
              onChange={(event) => setQuery(event.target.value)}
              aria-label="Search knowledge"
              placeholder="Search knowledge, notes, topics, or ask anything..."
              className="text-xs shadow-xs focus:border-accent-primary h-11 w-full rounded-xl border border-subtle bg-surface-1 pr-12 pl-10 text-primary outline-none"
            />
            <kbd className="absolute top-1/2 right-3 -translate-y-1/2 rounded-md bg-layer-1 px-2 py-1 text-[10px] text-tertiary">
              ⌘ K
            </kbd>
          </label>

          <section className="border-accent-primary/20 rounded-2xl border bg-accent-subtle/50 p-5">
            <div className="flex items-center gap-3">
              <span className="grid size-12 place-items-center rounded-xl bg-accent-primary text-white">
                <Sparkles className="size-6" />
              </span>
              <div>
                <h2 className="text-sm font-semibold text-primary">Ask Summon Assistant anything</h2>
                <p className="text-xs mt-1 text-secondary">
                  Get answers from accessible workspace, project, and Plane Page context.
                </p>
              </div>
            </div>
            <Link
              href={`/${workspaceSlug}/summon/assistant/`}
              className="text-xs shadow-xs mt-5 flex h-12 items-center gap-3 rounded-xl border border-subtle bg-surface-1 px-4 text-secondary"
            >
              <span className="flex-1">Ask a question about projects, clients, processes, or anything...</span>
              <Send className="size-4" />
            </Link>
            <div className="mt-3 flex flex-wrap gap-2">
              {["Summarize a project", "Find recent meeting notes", "Show deployment knowledge"].map((prompt) => (
                <Link
                  key={prompt}
                  href={`/${workspaceSlug}/summon/assistant/`}
                  className="rounded-full border border-subtle bg-surface-1 px-3 py-2 text-[10px] text-secondary"
                >
                  {prompt}
                </Link>
              ))}
            </div>
          </section>

          <section>
            <div className="mb-3">
              <h2 className="text-sm font-semibold text-primary">Browse by Context</h2>
              <p className="mt-1 text-[11px] text-secondary">Knowledge organized by its real workspace context</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-5">
              {contextCards.map(({ label, count, icon: Icon, detail }) => (
                <article key={label} className="shadow-xs rounded-2xl border border-subtle bg-surface-1 p-4">
                  <div className="flex items-center justify-between">
                    <span className="grid size-8 place-items-center rounded-lg bg-accent-subtle text-accent-primary">
                      <Icon className="size-4" />
                    </span>
                    <span className="rounded-full bg-layer-1 px-2 py-1 text-[10px] text-secondary">
                      {summary.status === "Exhausted" ? count : "…"}
                    </span>
                  </div>
                  <h3 className="text-xs mt-4 font-semibold text-primary">{label}</h3>
                  <p className="mt-1 text-[10px] leading-relaxed text-secondary">{detail}</p>
                </article>
              ))}
            </div>
          </section>

          <section>
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-primary">Recent Knowledge</h2>
                <div className="mt-3 flex gap-4 overflow-x-auto">
                  {["All", "Notes", "Documents", "Guides", "FAQs", "Lessons Learned"].map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => setTab(item)}
                      className={`shrink-0 border-b-2 pb-2 text-[10px] ${tab === item ? "border-accent-primary font-medium text-accent-primary" : "border-transparent text-secondary"}`}
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </div>
              <span className="text-[10px] text-secondary">{filteredPages.length} accessible items loaded</span>
            </div>
            {status === "CanLoadMore" && (
              <button
                type="button"
                className="text-xs mt-3 rounded-xl border border-subtle px-4 py-2"
                onClick={() => loadMore(50)}
              >
                Load more knowledge
              </button>
            )}
            {status === "LoadingMore" && <p role="status">Loading more knowledge…</p>}
            <SummonRequestState
              loading={isLoading}
              empty={status === "Exhausted" && filteredPages.length === 0}
              emptyMessage="No accessible knowledge matches this filter."
            />
            {!!filteredPages.length && (
              <div className="mt-3 overflow-x-auto rounded-2xl border border-subtle bg-surface-1">
                <table className="text-xs w-full min-w-[46rem] text-left">
                  <thead className="border-b border-subtle bg-layer-1 text-[10px] text-tertiary">
                    <tr>
                      <th className="px-4 py-3 font-medium">Title</th>
                      <th className="px-4 py-3 font-medium">Context</th>
                      <th className="px-4 py-3 font-medium">Type</th>
                      <th className="px-4 py-3 font-medium">Updated</th>
                      <th className="px-4 py-3 font-medium">Updated by</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-subtle">
                    {filteredPages.map(({ document, projects, updatedByName }) => {
                      return (
                        <tr key={document._id} className="hover:bg-layer-1">
                          <td className="px-4 py-3">
                            <Link
                              href={`/${workspaceSlug}/summon/documents/?document=${document._id}`}
                              className="flex items-center gap-2 font-medium text-primary"
                            >
                              <FileText className="size-4 shrink-0 text-accent-primary" />
                              <span className="max-w-64 truncate">{document.name || "Untitled Page"}</span>
                            </Link>
                          </td>
                          <td className="px-4 py-3 text-secondary">
                            {projects.map((project) => project.name).join(", ") || "Workspace"}
                          </td>
                          <td className="px-4 py-3">
                            <span className="rounded-full bg-accent-subtle px-2 py-1 text-[10px] text-accent-primary">
                              {document.category || "Page"}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-secondary">{formatDate(document.updatedAt)}</td>
                          <td className="px-4 py-3 text-secondary">{updatedByName || "Unknown"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </main>

        <aside className="space-y-4">
          <SidePanel title="Quick Actions">
            <div className="space-y-1">
              <QuickAction
                icon={FileText}
                label="Create New Note"
                href={
                  firstProject
                    ? `/${workspaceSlug}/projects/${firstProject._id}/pages/`
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
          </SidePanel>
          <SidePanel title="Recent Notes" href={`/${workspaceSlug}/summon/documents/`}>
            <div className="space-y-3">
              {recentPages.slice(0, 5).map(({ document }) => (
                <Link
                  key={document._id}
                  href={`/${workspaceSlug}/summon/documents/?document=${document._id}`}
                  className="flex gap-2"
                >
                  <FileText className="mt-0.5 size-4 shrink-0 text-accent-primary" />
                  <span className="min-w-0">
                    <strong className="block truncate text-[11px] font-medium text-primary">
                      {document.name || "Untitled Page"}
                    </strong>
                    <small className="text-[10px] text-secondary">{formatDate(document.updatedAt)}</small>
                  </span>
                </Link>
              ))}
              {!recentPages.length && (
                <Empty text={summary.status === "Exhausted" ? "No accessible notes." : "Loading notes…"} />
              )}
            </div>
          </SidePanel>
          <SidePanel title="Popular Knowledge">
            <Empty text="View analytics are not available from Plane Pages." />
          </SidePanel>
          <SidePanel title="Knowledge Stats">
            <div className="grid grid-cols-2 gap-2">
              <Stat label="Total Pages" value={summary.status === "Exhausted" ? String(pages.length) : "…"} />
              <Stat
                label="Projects"
                value={
                  summary.status === "Exhausted"
                    ? String(new Set(pages.flatMap(({ projects }) => projects.map((project) => project.id))).size)
                    : "…"
                }
              />
              <Stat
                label="Contributors"
                value={summary.status === "Exhausted" ? String(uniqueContributors.size) : "…"}
              />
              <Stat label="Total Views" value="Unavailable" />
            </div>
          </SidePanel>
        </aside>
      </div>
    </div>
  );
}

function SidePanel({ title, href, children }: { title: string; href?: string; children: React.ReactNode }) {
  return (
    <section className="shadow-xs rounded-2xl border border-subtle bg-surface-1 p-4">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xs font-semibold text-primary">{title}</h2>
        {href && (
          <Link href={href} className="inline-flex items-center gap-1 text-[10px] text-accent-primary">
            View all <ArrowRight className="size-3" />
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}
function QuickAction({ icon: Icon, label, href }: { icon: typeof FileText; label: string; href: string }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-lg px-2 py-2.5 text-[11px] text-primary hover:bg-layer-1"
    >
      <Icon className="size-4 text-accent-primary" />
      <span className="flex-1">{label}</span>
      <ChevronRight className="size-3.5 text-tertiary" />
    </Link>
  );
}
function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-subtle p-3">
      <p className="text-[9px] text-tertiary">{label}</p>
      <p className="text-sm mt-1 truncate font-semibold text-primary">{value}</p>
    </div>
  );
}
function Empty({ text }: { text: string }) {
  return (
    <p className="rounded-xl border border-dashed border-subtle p-3 text-center text-[11px] text-tertiary">{text}</p>
  );
}
