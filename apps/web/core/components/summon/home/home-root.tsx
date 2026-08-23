/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import useSWR from "swr";
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
import { SummonRequestState } from "@/components/summon/request-state";
import { useUser } from "@/hooks/store/user";
import { summonService } from "@/services/summon.service";

interface IHomeRootProps {
  workspaceSlug: string;
}

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

export function HomeRoot({ workspaceSlug }: IHomeRootProps) {
  const { data: user } = useUser();
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [filter, setFilter] = useState<THomeFilter>("all");
  const [query, setQuery] = useState("");
  const { data, error, isLoading, mutate } = useSWR(["summon-home", workspaceSlug], () =>
    summonService.getHomeSummary(workspaceSlug)
  );
  const { data: opportunities = [] } = useSWR(["summon-home-opportunities", workspaceSlug], () =>
    summonService.listOpportunities(workspaceSlug)
  );

  const activeProjectId = selectedProjectId || data?.projects[0]?.id || "";
  const { data: selectedProject, isLoading: projectLoading } = useSWR(
    activeProjectId ? ["summon-project-preview", workspaceSlug, activeProjectId] : null,
    () => summonService.getProjectOverview(workspaceSlug, activeProjectId)
  );
  const { data: selectedClient } = useSWR(
    selectedProject?.profile?.client
      ? ["summon-home-project-client", workspaceSlug, selectedProject.profile.client]
      : null,
    () => summonService.getClient(workspaceSlug, selectedProject?.profile?.client || "")
  );

  const normalizedQuery = query.trim().toLowerCase();
  const visibleProjects = useMemo(
    () => data?.projects.filter((project) => project.name.toLowerCase().includes(normalizedQuery)) ?? [],
    [data?.projects, normalizedQuery]
  );
  const visiblePriority = useMemo(
    () =>
      data?.priority.filter((issue) => `${issue.name} ${issue.project.name}`.toLowerCase().includes(normalizedQuery)) ??
      [],
    [data?.priority, normalizedQuery]
  );
  const visibleOpportunities = useMemo(
    () => opportunities.filter((opportunity) => opportunity.title.toLowerCase().includes(normalizedQuery)),
    [opportunities, normalizedQuery]
  );

  if (!data) return <SummonRequestState loading={isLoading} error={error} onRetry={() => void mutate()} />;

  const firstName = (user?.display_name || user?.first_name || "there").split(" ")[0];
  const openIssues = selectedProject?.issues.filter((issue) => !issue.completed) ?? [];

  return (
    <div className="grid min-h-full bg-surface-1 xl:grid-cols-[minmax(20rem,0.72fr)_minmax(34rem,1.28fr)]">
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
            placeholder="Search anything (projects, docs, people...)"
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
            empty="No priority work items."
          >
            {visiblePriority.slice(0, 3).map((issue) => (
              <Link
                key={issue.id}
                href={`/${workspaceSlug}/projects/${issue.project.id}/issues/${issue.id}/`}
                className="hover:border-accent-primary/40 flex items-center gap-3 rounded-xl border border-subtle bg-surface-1 px-3 py-2.5"
              >
                <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-danger-subtle text-danger-primary">
                  <Circle className="size-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="text-xs block truncate font-medium text-primary">{issue.name}</span>
                  <span className="block truncate text-[10px] text-secondary">{issue.project.name}</span>
                </span>
                <span className="rounded-full bg-layer-1 px-2 py-1 text-[10px] text-secondary">
                  {issue.state?.name || "Open"}
                </span>
              </Link>
            ))}
          </HomeListSection>
        )}

        {(filter === "all" || filter === "projects") && (
          <HomeListSection
            title="Active Projects"
            href={`/${workspaceSlug}/summon/projects/`}
            action="See all projects"
            empty="No active projects."
          >
            {visibleProjects.slice(0, 5).map((project) => (
              <button
                key={project.id}
                type="button"
                onClick={() => setSelectedProjectId(project.id)}
                className={`flex w-full items-center gap-3 border-b border-subtle px-2 py-2 text-left last:border-0 ${activeProjectId === project.id ? "rounded-lg bg-accent-subtle" : "hover:bg-layer-1"}`}
              >
                <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-layer-2 text-[11px] font-semibold text-accent-primary">
                  {project.identifier.slice(0, 2)}
                </span>
                <span className="text-xs min-w-0 flex-1 truncate font-medium text-primary">{project.name}</span>
                <span className="rounded-full bg-success-subtle px-2 py-1 text-[10px] text-success-primary">
                  {project.health || `${project.completion}%`}
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
            empty="No active opportunities."
          >
            {visibleOpportunities.slice(0, 3).map((opportunity) => (
              <Link
                key={opportunity.id}
                href={`/${workspaceSlug}/summon/opportunities/${opportunity.id}/`}
                className="flex items-center gap-3 border-b border-subtle px-2 py-2 last:border-0 hover:bg-layer-1"
              >
                <BriefcaseBusiness className="size-4 shrink-0 text-accent-primary" />
                <span className="text-xs min-w-0 flex-1 truncate font-medium text-primary">{opportunity.title}</span>
                <span className="rounded-full bg-layer-1 px-2 py-1 text-[10px] text-secondary">
                  {opportunity.stage}
                </span>
              </Link>
            ))}
          </HomeListSection>
        )}

        {filter === "documents" && (
          <HomeListSection
            title="Documents"
            href={`/${workspaceSlug}/summon/knowledge/`}
            action="See all documents"
            empty="Select a project to see documents."
          >
            {selectedProject?.pages.slice(0, 5).map((page) => (
              <Link key={page.id} href={page.href} className="flex items-center gap-3 px-2 py-2 hover:bg-layer-1">
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

      <section className="min-w-0 bg-surface-1">
        {projectLoading || !selectedProject ? (
          <div className="text-sm grid min-h-[32rem] place-items-center p-8 text-secondary">
            {activeProjectId ? "Loading project workspace…" : "Select an active project to open its workspace."}
          </div>
        ) : (
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
                        {selectedProject.profile?.delivery_status || "Status not set"}
                      </span>
                    </div>
                    <p className="text-xs mt-1 text-secondary">
                      Client: {selectedClient?.company_name || "Not linked"}
                    </p>
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
              <PreviewCard title="Project Progress">
                <div className="flex items-end gap-2">
                  <strong className="text-3xl font-semibold text-primary">
                    {selectedProject.progress.percentage}%
                  </strong>
                  <span className="pb-1 text-[11px] text-secondary">Overall progress</span>
                </div>
                <div className="mt-4 h-2 overflow-hidden rounded-full bg-layer-2">
                  <div
                    className="h-full rounded-full bg-accent-primary"
                    style={{ width: `${selectedProject.progress.percentage}%` }}
                  />
                </div>
                <div className="mt-5 grid grid-cols-2 gap-3 border-t border-subtle pt-4">
                  <Info label="Current phase" value={selectedProject.profile?.phase || "Not set"} />
                  <Info label="Next milestone" value={selectedProject.milestones[0]?.name || "Not set"} />
                </div>
              </PreviewCard>
              <PreviewCard title="Project Info">
                <dl className="space-y-3">
                  <InfoRow label="Project manager" value="Not available" />
                  <InfoRow label="Client" value={selectedClient?.company_name || "Not linked"} />
                  <InfoRow label="Start date" value={formatDate(selectedProject.profile?.start_date)} />
                  <InfoRow label="Target date" value={formatDate(selectedProject.profile?.target_date)} />
                  <InfoRow label="Budget" value={selectedProject.profile?.budget || "Not set"} />
                </dl>
              </PreviewCard>

              <PreviewCard title="Quick Access" className="2xl:col-span-2">
                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                  {selectedProject.resources.slice(0, 5).map((resource) => (
                    <a
                      key={resource.id}
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
                  {!selectedProject.resources.length && <EmptyLine text="No project resources linked." />}
                </div>
              </PreviewCard>

              <PreviewCard title="Open Tasks" href={`/${workspaceSlug}/projects/${activeProjectId}/issues/`}>
                <div className="divide-y divide-subtle">
                  {openIssues.slice(0, 5).map((issue) => (
                    <Link
                      key={issue.id}
                      href={`/${workspaceSlug}/projects/${activeProjectId}/issues/${issue.id}/`}
                      className="flex items-center gap-2 py-2.5"
                    >
                      <Circle className="size-4 shrink-0 text-tertiary" />
                      <span className="text-xs min-w-0 flex-1 truncate text-primary">{issue.name}</span>
                      <span className="text-[10px] text-secondary">{issue.state?.name || "Open"}</span>
                    </Link>
                  ))}
                  {!openIssues.length && <EmptyLine text="No open work items." />}
                </div>
              </PreviewCard>
              <PreviewCard title="Latest Documents" href={`/${workspaceSlug}/projects/${activeProjectId}/pages/`}>
                <div className="divide-y divide-subtle">
                  {selectedProject.pages.slice(0, 5).map((page) => (
                    <Link key={page.id} href={page.href} className="flex items-center gap-2 py-2.5">
                      <FileText className="size-4 shrink-0 text-accent-primary" />
                      <span className="text-xs min-w-0 flex-1 truncate text-primary">{page.name}</span>
                    </Link>
                  ))}
                  {!selectedProject.pages.length && <EmptyLine text="No project documents." />}
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
        )}
      </section>
    </div>
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

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] text-tertiary">{label}</p>
      <p className="text-xs mt-1 font-medium text-primary">{value}</p>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-[10px] text-tertiary">{label}</dt>
      <dd className="text-xs text-right font-medium text-primary">{value}</dd>
    </div>
  );
}

function EmptyLine({ text }: { text: string }) {
  return (
    <p className="text-xs rounded-xl border border-dashed border-subtle px-3 py-4 text-center text-tertiary">{text}</p>
  );
}
