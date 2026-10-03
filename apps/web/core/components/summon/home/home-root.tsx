/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { useOutletContext } from "react-router";
import { useQuery } from "convex/react";
import { usePaginatedQuery } from "convex-helpers/react";
import type { FunctionReturnType } from "convex/server";
import type { Id } from "@summon/convex/data-model";
import { api } from "@summon/convex/api";
import type { WorkspaceSession } from "@/components/workspace/native-shell/session";
import { PreservedWorkspaceShell } from "@/components/workspace/native-shell/workspace-shell";
import { useStickiesCommands } from "@/components/stickies/native/provider";
import {
  ArrowRight,
  BriefcaseBusiness,
  ChevronRight,
  Circle,
  FileText,
  FolderKanban,
  Search,
  Send,
  Sparkles,
} from "lucide-react";

type THomeFilter = "all" | "projects" | "tasks" | "opportunities" | "documents";

const filters: Array<{ id: THomeFilter; label: string }> = [
  { id: "all", label: "All" },
  { id: "projects", label: "Projects" },
  { id: "tasks", label: "Tasks" },
  { id: "opportunities", label: "Opportunities" },
  { id: "documents", label: "Documents" },
];

const formatDate = (value?: string | null) => {
  if (!value) return "Not set";
  return new Intl.DateTimeFormat("en", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value));
};

export function HomeRoot() {
  const session = useOutletContext<WorkspaceSession>();
  const commands = useStickiesCommands();
  const [selectedProjectId, setSelectedProjectId] = useState<Id<"projects"> | null>(null);
  const projects = useQuery(api.projects.index.list, { workspaceId: session.workspace._id });
  const activeProject = projects?.find((project) => project._id === selectedProjectId) ?? projects?.[0];
  return (
    <PreservedWorkspaceShell
      {...session}
      onCreateSticky={commands.create}
      onOpenStickies={commands.openAll}
      beforeLeave={commands.flushAll}
    >
      <div className="grid min-h-full bg-surface-1 xl:grid-cols-[minmax(20rem,0.72fr)_minmax(34rem,1.28fr)]">
        <HomeActivity projects={projects} activeProjectId={activeProject?._id} onSelect={setSelectedProjectId} />
        <section className="min-w-0 bg-surface-1">
          {activeProject ? (
            <ProjectPreview key={activeProject._id} projectId={activeProject._id} />
          ) : (
            <div className="text-sm grid min-h-[32rem] place-items-center p-8 text-secondary">
              {projects ? "Select an active project to open its workspace." : "Loading projects…"}
            </div>
          )}
        </section>
      </div>
    </PreservedWorkspaceShell>
  );
}

function HomeActivity({
  projects,
  activeProjectId,
  onSelect,
}: {
  projects: FunctionReturnType<typeof api.projects.index.list> | undefined;
  activeProjectId: Id<"projects"> | undefined;
  onSelect: (id: Id<"projects">) => void;
}) {
  const { workspace, user } = useOutletContext<WorkspaceSession>();
  const workspaceSlug = workspace.slug;
  const [filter, setFilter] = useState<THomeFilter>("all");
  const [query, setQuery] = useState("");
  const [today] = useState(() => new Date().toISOString().slice(0, 10));
  const priority = usePaginatedQuery(
    api.tasks.center.list,
    { workspaceId: workspace._id, scope: "all", due: "all", attention: true, today, search: query },
    { initialNumItems: 3 }
  );
  const opportunities = usePaginatedQuery(
    api.commercial.opportunities.list,
    { workspaceId: workspace._id, search: query, stage: null },
    { initialNumItems: 3 }
  );
  const selectedPages = usePaginatedQuery(
    api.documents.index.list,
    activeProjectId ? { workspaceId: workspace._id, projectId: activeProjectId } : "skip",
    { initialNumItems: 5 }
  );
  useEffect(() => {
    for (const [preview, limit] of [
      [priority, 3],
      [opportunities, 3],
      [selectedPages, 5],
    ] as const)
      if (preview.status === "CanLoadMore" && preview.results.length < limit) preview.loadMore(limit);
  });
  const visibleProjects =
    projects?.filter((project) => project.name.toLowerCase().includes(query.trim().toLowerCase())) ?? [];
  const visiblePriority = priority.results;
  const visibleOpportunities = opportunities.results;
  const firstName = (user.displayName || user.firstName || "there").split(" ")[0];
  return (
    <section className="flex min-w-0 flex-col border-r border-subtle bg-canvas p-4 lg:p-5">
      <header>
        <p className="text-xs font-medium text-secondary">Good to see you, {firstName}.</p>
        <h1 className="text-2xl mt-1 font-semibold tracking-tight text-primary">Here&apos;s what&apos;s happening</h1>
      </header>

      <label className="relative mt-5 block">
        <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-tertiary" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          aria-label="Search dashboard"
          maxLength={255}
          placeholder="Search projects, tasks and opportunities"
          className="text-xs shadow-xs focus:border-accent-primary h-11 w-full rounded-xl border border-subtle bg-surface-1 pr-12 pl-10 text-primary outline-none"
        />
        <kbd className="absolute top-1/2 right-3 -translate-y-1/2 rounded-md bg-layer-1 px-2 py-1 text-[10px] text-tertiary">
          ⌘ K
        </kbd>
      </label>

      <div className="mt-3 flex gap-1 overflow-x-auto pb-1">
        {filters.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setFilter(item.id)}
            className={`shrink-0 rounded-lg px-3 py-1.5 text-[11px] font-medium ${filter === item.id ? "bg-accent-subtle text-accent-primary" : "text-secondary hover:bg-layer-1"}`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {(filter === "all" || filter === "tasks") && (
        <HomeListSection
          title="Priority"
          href={`/${workspaceSlug}/summon/tasks/`}
          action="See all tasks"
          empty={priority.status === "Exhausted" ? "No priority work items." : "Loading priority work…"}
        >
          {visiblePriority.slice(0, 3).map(({ task: issue, project }) => (
            <Link
              key={issue._id}
              href={`/${workspaceSlug}/projects/${project.id}/issues/${issue._id}/`}
              className="hover:border-accent-primary/40 flex items-center gap-3 rounded-xl border border-subtle bg-surface-1 px-3 py-2.5"
            >
              <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-danger-subtle text-danger-primary">
                <Circle className="size-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="text-xs block truncate font-medium text-primary">{issue.title}</span>
                <span className="block truncate text-[10px] text-secondary">{project.name}</span>
              </span>
              <span className="rounded-full bg-layer-1 px-2 py-1 text-[10px] text-secondary">{issue.status}</span>
            </Link>
          ))}
        </HomeListSection>
      )}

      {(filter === "all" || filter === "projects") && (
        <HomeListSection
          title="Active Projects"
          href={`/${workspaceSlug}/summon/projects/`}
          action="See all projects"
          empty={projects ? "No active projects." : "Loading projects…"}
        >
          {visibleProjects.slice(0, 5).map((project) => (
            <button
              key={project._id}
              type="button"
              onClick={() => onSelect(project._id)}
              className={`flex w-full items-center gap-3 border-b border-subtle px-2 py-2 text-left last:border-0 ${activeProjectId === project._id ? "rounded-lg bg-accent-subtle" : "hover:bg-layer-1"}`}
            >
              <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-layer-2 text-[11px] font-semibold text-accent-primary">
                {project.identifier.slice(0, 2)}
              </span>
              <span className="text-xs min-w-0 flex-1 truncate font-medium text-primary">{project.name}</span>
              <span className="rounded-full bg-success-subtle px-2 py-1 text-[10px] text-success-primary">
                {project.profile?.health || "Not assessed"}
              </span>
            </button>
          ))}
        </HomeListSection>
      )}

      {(filter === "all" || filter === "opportunities") && (
        <HomeListSection
          title="Opportunities"
          href={`/${workspaceSlug}/summon/opportunities/`}
          action="See all opportunities"
          empty={opportunities.status === "Exhausted" ? "No active opportunities." : "Loading opportunities…"}
        >
          {visibleOpportunities.slice(0, 3).map((opportunity) => (
            <Link
              key={opportunity._id}
              href={`/${workspaceSlug}/summon/opportunities/${opportunity._id}/`}
              className="flex items-center gap-3 border-b border-subtle px-2 py-2 last:border-0 hover:bg-layer-1"
            >
              <BriefcaseBusiness className="size-4 shrink-0 text-accent-primary" />
              <span className="text-xs min-w-0 flex-1 truncate font-medium text-primary">{opportunity.title}</span>
              <span className="rounded-full bg-layer-1 px-2 py-1 text-[10px] text-secondary">{opportunity.stage}</span>
            </Link>
          ))}
        </HomeListSection>
      )}

      {filter === "documents" && (
        <HomeListSection
          title="Documents"
          href={`/${workspaceSlug}/summon/knowledge/`}
          action="See all documents"
          empty={selectedPages.status === "Exhausted" ? "No project documents." : "Loading documents…"}
        >
          {selectedPages.results.slice(0, 5).map(({ document: page }) => (
            <Link
              key={page._id}
              href={`/${workspaceSlug}/projects/${activeProjectId}/pages/${page._id}/`}
              className="flex items-center gap-3 px-2 py-2 hover:bg-layer-1"
            >
              <FileText className="size-4 text-accent-primary" />
              <span className="text-xs truncate text-primary">{page.name}</span>
            </Link>
          ))}
        </HomeListSection>
      )}

      <Link
        href={`/${workspaceSlug}/summon/assistant/`}
        className="text-xs hover:border-accent-primary/40 mt-auto flex items-center gap-3 rounded-2xl border border-subtle bg-surface-1 px-4 py-3 text-secondary"
      >
        <Sparkles className="size-4 text-accent-primary" />
        <span className="flex-1">Ask Summon Assistant anything...</span>
        <Send className="size-4" />
      </Link>
    </section>
  );
}

function ProjectPreview({ projectId: activeProjectId }: { projectId: Id<"projects"> }) {
  const { workspace } = useOutletContext<WorkspaceSession>();
  const workspaceSlug = workspace.slug;
  const selectedProject = useQuery(api.reporting.overview.project, { projectId: activeProjectId });
  const selectedPages = usePaginatedQuery(
    api.documents.index.list,
    { workspaceId: workspace._id, projectId: activeProjectId },
    { initialNumItems: 5 }
  );
  const selectedResources = usePaginatedQuery(
    api.resources.index.list,
    { workspaceId: workspace._id, projectId: activeProjectId },
    { initialNumItems: 5 }
  );
  const selectedTasks = usePaginatedQuery(
    api.tasks.index.list,
    { projectId: activeProjectId, openOnly: true },
    { initialNumItems: 5 }
  );
  useEffect(() => {
    for (const preview of [selectedPages, selectedResources, selectedTasks])
      if (preview.status === "CanLoadMore" && preview.results.length < 5) preview.loadMore(5);
  });
  const openIssues = selectedTasks.results;
  if (!selectedProject)
    return (
      <p role="status" className="p-8">
        Loading project workspace…
      </p>
    );
  const clientName = selectedProject.client
    ? selectedProject.client.companyName || selectedProject.client.name
    : "Not linked";
  return (
    <div className="flex min-h-full flex-col">
      <header className="border-b border-subtle p-4 lg:p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <span className="text-sm grid size-11 shrink-0 place-items-center rounded-xl bg-accent-subtle font-semibold text-accent-primary">
              {selectedProject.project.identifier.slice(0, 2)}
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl truncate font-semibold text-primary">{selectedProject.project.name}</h2>
                <span className="rounded-full bg-success-subtle px-2.5 py-1 text-[10px] text-success-primary">
                  {selectedProject.profile?.deliveryStatus || "Status not set"}
                </span>
              </div>
              <p className="text-xs mt-1 text-secondary">Client: {clientName}</p>
            </div>
          </div>
          <Link
            href={`/${workspaceSlug}/summon/projects/${activeProjectId}/`}
            className="text-xs inline-flex items-center gap-2 rounded-xl bg-accent-primary px-4 py-2.5 font-medium text-white"
          >
            Open Workspace <ArrowRight className="size-4" />
          </Link>
        </div>
        <nav className="mt-5 flex gap-6 overflow-x-auto" aria-label="Project preview navigation">
          {[
            ["Overview", `/${workspaceSlug}/summon/projects/${activeProjectId}/`],
            ["Tasks", `/${workspaceSlug}/projects/${activeProjectId}/issues/`],
            ["Documents", `/${workspaceSlug}/projects/${activeProjectId}/pages/`],
            ["Access", `/${workspaceSlug}/settings/projects/${activeProjectId}/members/`],
            ["Activity", `/${workspaceSlug}/summon/projects/${activeProjectId}/`],
            ["Notes", `/${workspaceSlug}/projects/${activeProjectId}/pages/`],
          ].map(([label, href], index) => (
            <Link
              key={label}
              href={href}
              className={`text-xs shrink-0 border-b-2 pb-2 font-medium ${index === 0 ? "border-accent-primary text-accent-primary" : "border-transparent text-secondary"}`}
            >
              {label}
            </Link>
          ))}
        </nav>
      </header>

      <div className="grid flex-1 gap-4 p-4 lg:p-5 2xl:grid-cols-2">
        <ProjectProgress projectId={activeProjectId} phase={selectedProject.profileForm.phase} />
        <PreviewCard title="Project Info">
          <dl className="space-y-3">
            <InfoRow label="Project manager" value={selectedProject.lead?.name} />
            <InfoRow label="Client" value={clientName} />
            <InfoRow label="Start date" value={formatDate(selectedProject.profileForm.startDate)} />
            <InfoRow label="Target date" value={formatDate(selectedProject.profileForm.targetDate)} />
            <InfoRow label="Budget" value={selectedProject.profileForm.budget} />
          </dl>
        </PreviewCard>

        <PreviewCard title="Quick Access" className="2xl:col-span-2">
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {selectedResources.results
              .filter((resource) => resource.projectId === activeProjectId)
              .slice(0, 5)
              .map((resource) => (
                <a
                  key={resource._id}
                  href={resource.url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 rounded-xl border border-subtle p-3 hover:bg-layer-1"
                >
                  <FolderKanban className="size-4 shrink-0 text-accent-primary" />
                  <span className="min-w-0">
                    <span className="text-xs block truncate font-medium text-primary">{resource.title}</span>
                    <span className="block truncate text-[10px] text-secondary">{resource.category}</span>
                  </span>
                </a>
              ))}
            {!selectedResources.results.some((resource) => resource.projectId === activeProjectId) && (
              <EmptyLine
                text={selectedResources.status === "Exhausted" ? "No project resources linked." : "Loading resources…"}
              />
            )}
          </div>
        </PreviewCard>

        <PreviewCard title="Open Tasks" href={`/${workspaceSlug}/projects/${activeProjectId}/issues/`}>
          <div className="divide-y divide-subtle">
            {openIssues.slice(0, 5).map((issue) => (
              <Link
                key={issue._id}
                href={`/${workspaceSlug}/projects/${activeProjectId}/issues/${issue._id}/`}
                className="flex items-center gap-2 py-2.5"
              >
                <Circle className="size-4 shrink-0 text-tertiary" />
                <span className="text-xs min-w-0 flex-1 truncate text-primary">{issue.title}</span>
                <span className="text-[10px] text-secondary">{issue.status}</span>
              </Link>
            ))}
            {!openIssues.length && (
              <EmptyLine text={selectedTasks.status === "Exhausted" ? "No open work items." : "Loading tasks…"} />
            )}
          </div>
        </PreviewCard>
        <PreviewCard title="Latest Documents" href={`/${workspaceSlug}/projects/${activeProjectId}/pages/`}>
          <div className="divide-y divide-subtle">
            {selectedPages.results.slice(0, 5).map(({ document: page }) => (
              <Link
                key={page._id}
                href={`/${workspaceSlug}/projects/${activeProjectId}/pages/${page._id}/`}
                className="flex items-center gap-2 py-2.5"
              >
                <FileText className="size-4 shrink-0 text-accent-primary" />
                <span className="text-xs min-w-0 flex-1 truncate text-primary">{page.name}</span>
              </Link>
            ))}
            {!selectedPages.results.length && (
              <EmptyLine text={selectedPages.status === "Exhausted" ? "No project documents." : "Loading documents…"} />
            )}
          </div>
        </PreviewCard>
      </div>

      <footer className="flex flex-wrap gap-2 border-t border-subtle p-4">
        {["Proposal", "Quotation", "MoM", "PPT", "Cost Projection"].map((label) => (
          <Link
            key={label}
            href={`/${workspaceSlug}/summon/automation/`}
            className="inline-flex items-center gap-2 rounded-xl border border-subtle px-3 py-2 text-[11px] text-primary hover:bg-layer-1"
          >
            <Sparkles className="size-3.5 text-accent-primary" /> {label}
          </Link>
        ))}
      </footer>
    </div>
  );
}

function ProjectProgress({ projectId: activeProjectId, phase }: { projectId: Id<"projects">; phase: string }) {
  const { workspace } = useOutletContext<WorkspaceSession>();
  const [today] = useState(() => new Date().toISOString().slice(0, 10));
  const milestones = usePaginatedQuery(
    api.cycles.index.list,
    { projectId: activeProjectId, deleted: false },
    { initialNumItems: 5 }
  );
  const modules = usePaginatedQuery(
    api.modules.index.list,
    { projectId: activeProjectId, deleted: false },
    { initialNumItems: 5 }
  );
  const progress = usePaginatedQuery(
    api.reporting.tasks.page,
    {
      scope: {
        workspaceId: workspace._id,
        projectId: activeProjectId,
        clientId: null,
        dateFrom: null,
        dateTo: null,
        today,
      },
    },
    { initialNumItems: 100 }
  );
  useEffect(() => {
    if (progress.status === "CanLoadMore") progress.loadMore(100);
    for (const preview of [modules, milestones])
      if (preview.status === "CanLoadMore" && !preview.results.some((item) => !item.archived)) preview.loadMore(5);
  });
  const totals = progress.results.reduce(
    (sum, page) => ({ total: sum.total + page.total, completed: sum.completed + page.completed }),
    { total: 0, completed: 0 }
  );
  const completion =
    progress.status === "Exhausted" ? (totals.total ? Math.round((totals.completed / totals.total) * 100) : 0) : null;
  const nextMilestone =
    modules.results.find((item) => !item.archived)?.name || milestones.results.find((item) => !item.archived)?.name;
  return (
    <PreviewCard title="Project Progress">
      <div className="flex items-end gap-2">
        <strong className="text-3xl font-semibold text-primary">{completion === null ? "…" : `${completion}%`}</strong>
        <span className="pb-1 text-[11px] text-secondary">Overall progress</span>
      </div>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-layer-2">
        <div className="h-full rounded-full bg-accent-primary" style={{ width: `${completion ?? 0}%` }} />
      </div>
      <div className="mt-5 grid grid-cols-2 gap-3 border-t border-subtle pt-4">
        <Info label="Current phase" value={phase} />
        <Info
          label="Next milestone"
          value={
            nextMilestone ||
            ([modules, milestones].every((preview) => preview.status === "Exhausted") ? "Not set" : "Loading…")
          }
        />
      </div>
    </PreviewCard>
  );
}

function HomeListSection(props: {
  title: string;
  href: string;
  action: string;
  empty: string;
  children: React.ReactNode;
}) {
  const hasChildren = Array.isArray(props.children) ? props.children.length > 0 : !!props.children;
  return (
    <section className="mt-5">
      <div className="mb-2 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-primary">{props.title}</h2>
        <Link
          href={props.href}
          className="inline-flex items-center gap-1 text-[10px] text-secondary hover:text-primary"
        >
          {props.action} <ChevronRight className="size-3.5" />
        </Link>
      </div>
      <div className="space-y-2">
        {props.children}
        {!hasChildren && <EmptyLine text={props.empty} />}
      </div>
    </section>
  );
}

function PreviewCard(props: { title: string; href?: string; className?: string; children: React.ReactNode }) {
  return (
    <section className={`shadow-xs rounded-2xl border border-subtle bg-surface-1 p-4 ${props.className || ""}`}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="text-xs font-semibold text-primary">{props.title}</h3>
        {props.href && (
          <Link href={props.href} className="inline-flex items-center gap-1 text-[10px] text-secondary">
            See all <ChevronRight className="size-3.5" />
          </Link>
        )}
      </div>
      {props.children}
    </section>
  );
}

function Info({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <p className="text-[10px] text-tertiary">{label}</p>
      <p className="text-xs mt-1 font-medium text-primary">{value || "Not set"}</p>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-[10px] text-tertiary">{label}</dt>
      <dd className="text-xs text-right font-medium text-primary">{value || "Not set"}</dd>
    </div>
  );
}

function EmptyLine({ text }: { text: string }) {
  return (
    <p className="text-xs rounded-xl border border-dashed border-subtle px-3 py-4 text-center text-tertiary">{text}</p>
  );
}
