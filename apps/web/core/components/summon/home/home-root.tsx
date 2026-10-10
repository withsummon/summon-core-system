/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import {
  BriefcaseIcon,
  CheckSquareIcon,
  ClockCounterClockwiseIcon,
  FileTextIcon,
  HandshakeIcon,
  NoteIcon,
  SquaresFourIcon,
  UsersThreeIcon,
} from "@phosphor-icons/react";
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
import { Chip } from "@plane/propel/chip";
import type { TSelectableIcon } from "@plane/propel/icons";
import { SummonRequestState } from "@/components/summon/request-state";
import { SectionTabs } from "@/components/summon/section-tabs";
import { StatusBadge } from "@/components/summon/status-badge";
import { useUser } from "@/hooks/store/user";
import { summonService } from "@/services/summon.service";

interface IHomeRootProps {
  workspaceSlug: string;
}

type THomeFilter = "all" | "projects" | "tasks" | "opportunities" | "documents";

const filters: Array<{ id: THomeFilter; label: string; icon: TSelectableIcon }> = [
  { id: "all", label: "All", icon: SquaresFourIcon },
  { id: "projects", label: "Projects", icon: BriefcaseIcon },
  { id: "tasks", label: "Tasks", icon: CheckSquareIcon },
  { id: "opportunities", label: "Opportunities", icon: HandshakeIcon },
  { id: "documents", label: "Documents", icon: FileTextIcon },
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
      <section className="flex min-w-0 flex-col border-r border-subtle bg-surface-1 p-4 lg:p-6">
        <header>
          <p className="text-13 text-tertiary">Good to see you, {firstName}</p>
          <h1 className="mt-0.5 text-2xl font-semibold text-primary">Here&apos;s what&apos;s happening</h1>
        </header>

        <label className="relative mt-5 block">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-placeholder" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search projects, tasks, opportunities"
            className="h-9 w-full rounded-lg border border-subtle bg-surface-1 pr-12 pl-9 text-13 text-primary shadow-raised-100 transition-[border-color,box-shadow] duration-150 outline-none placeholder:text-placeholder focus-visible:border-accent-strong focus-visible:ring-[3px] focus-visible:ring-accent-subtle"
          />
          <kbd className="absolute top-1/2 right-2 -translate-y-1/2 rounded-sm border border-subtle bg-layer-1 px-1.5 py-0.5 font-body text-11 font-medium text-tertiary">
            ⌘K
          </kbd>
        </label>

        <div className="mt-3 flex gap-1.5 overflow-x-auto pb-1" role="group" aria-label="Filter home">
          {filters.map((item) => (
            <Chip key={item.id} icon={item.icon} selected={filter === item.id} onClick={() => setFilter(item.id)}>
              {item.label}
            </Chip>
          ))}
        </div>

        {(filter === "all" || filter === "tasks") && (
          <HomeListSection
            title="Priority"
            href={`/${workspaceSlug}/summon/tasks/`}
            action="All tasks"
            empty="Nothing urgent right now."
          >
            {visiblePriority.slice(0, 3).map((issue) => (
              <Link
                key={issue.id}
                href={`/${workspaceSlug}/projects/${issue.project.id}/issues/${issue.id}/`}
                className="group flex items-center gap-3 rounded-md px-2 py-2.5 hover:bg-layer-1"
              >
                <Circle className="size-4 shrink-0 text-danger-secondary" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-13 font-medium text-primary">{issue.name}</span>
                  <span className="block truncate text-12 text-tertiary">{issue.project.name}</span>
                </span>
                <StatusBadge status={issue.state?.group ?? "unstarted"} label={issue.state?.name || "Open"} />
              </Link>
            ))}
          </HomeListSection>
        )}

        {(filter === "all" || filter === "projects") && (
          <HomeListSection
            title="Active projects"
            href={`/${workspaceSlug}/summon/projects/`}
            action="All projects"
            empty="No active projects."
          >
            {visibleProjects.slice(0, 5).map((project) => {
              const selected = activeProjectId === project.id;
              return (
                <button
                  key={project.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setSelectedProjectId(project.id)}
                  className={`flex w-full items-center gap-3 rounded-md px-2 py-2 text-left ${selected ? "bg-layer-1" : "hover:bg-layer-1"}`}
                >
                  <ProjectMark identifier={project.identifier} />
                  <span className="min-w-0 flex-1 truncate text-13 font-medium text-primary">{project.name}</span>
                  {project.health ? (
                    <StatusBadge status={project.health} />
                  ) : (
                    <StatusBadge status="active" label={`${project.completion}%`} />
                  )}
                </button>
              );
            })}
          </HomeListSection>
        )}

        {(filter === "all" || filter === "opportunities") && (
          <HomeListSection
            title="Opportunities"
            href={`/${workspaceSlug}/summon/opportunities/`}
            action="All opportunities"
            empty="No active opportunities."
          >
            {visibleOpportunities.slice(0, 3).map((opportunity) => (
              <Link
                key={opportunity.id}
                href={`/${workspaceSlug}/summon/opportunities/${opportunity.id}/`}
                className="flex items-center gap-3 rounded-md px-2 py-2 hover:bg-layer-1"
              >
                <IconTile>
                  <BriefcaseBusiness className="size-3.5" />
                </IconTile>
                <span className="min-w-0 flex-1 truncate text-13 font-medium text-primary">{opportunity.title}</span>
                <StatusBadge status={opportunity.stage} />
              </Link>
            ))}
          </HomeListSection>
        )}

        {filter === "documents" && (
          <HomeListSection
            title="Documents"
            href={`/${workspaceSlug}/summon/knowledge/`}
            action="All documents"
            empty="Select a project to see its documents."
          >
            {selectedProject?.pages.slice(0, 5).map((page) => (
              <Link
                key={page.id}
                href={page.href}
                className="flex items-center gap-3 rounded-md px-2 py-2 hover:bg-layer-1"
              >
                <IconTile>
                  <FileText className="size-3.5" />
                </IconTile>
                <span className="truncate text-13 text-primary">{page.name}</span>
              </Link>
            ))}
          </HomeListSection>
        )}

        <Link
          href={`/${workspaceSlug}/summon/assistant/`}
          className="mt-auto flex h-11 press items-center gap-3 rounded-xl border border-subtle bg-surface-1 px-4 text-13 text-tertiary shadow-raised-200 hover:text-secondary"
        >
          <Sparkles className="size-4 text-accent-primary" />
          <span className="flex-1">Ask Summon Assistant anything…</span>
          <span className="grid size-7 place-items-center rounded-lg bg-accent-primary text-on-color shadow-tactile-accent">
            <Send className="size-3.5" />
          </span>
        </Link>
      </section>

      <section className="min-w-0 bg-canvas">
        {projectLoading || !selectedProject ? (
          <div className="grid min-h-[32rem] place-items-center bg-dot-grid p-8 text-13 text-tertiary">
            {activeProjectId ? "Loading project workspace…" : "Select an active project to preview it here."}
          </div>
        ) : (
          <div className="flex min-h-full flex-col">
            <header className="border-b border-subtle bg-surface-1 px-4 pt-4 lg:px-6 lg:pt-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex min-w-0 items-center gap-3">
                  <ProjectMark identifier={selectedProject.project.identifier} size="lg" />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="truncate text-xl font-semibold text-primary">{selectedProject.project.name}</h2>
                      <StatusBadge status={selectedProject.profile?.delivery_status || "not_assessed"} />
                    </div>
                    <p className="mt-0.5 text-13 text-tertiary">
                      Client · {selectedClient?.company_name || "Not linked"}
                    </p>
                  </div>
                </div>
                <Link
                  href={`/${workspaceSlug}/summon/projects/${activeProjectId}/`}
                  className="inline-flex h-9 press items-center gap-2 rounded-lg bg-accent-primary px-3.5 text-13 font-medium text-on-color shadow-tactile-accent hover:bg-accent-primary-hover"
                >
                  Open workspace <ArrowRight className="size-4" />
                </Link>
              </div>
              <SectionTabs
                items={[
                  {
                    value: "overview",
                    label: "Overview",
                    icon: SquaresFourIcon,
                    href: `/${workspaceSlug}/summon/projects/${activeProjectId}/`,
                  },
                  {
                    value: "tasks",
                    label: "Tasks",
                    icon: CheckSquareIcon,
                    href: `/${workspaceSlug}/projects/${activeProjectId}/issues/`,
                  },
                  {
                    value: "documents",
                    label: "Documents",
                    icon: FileTextIcon,
                    href: `/${workspaceSlug}/projects/${activeProjectId}/pages/`,
                  },
                  {
                    value: "access",
                    label: "Access",
                    icon: UsersThreeIcon,
                    href: `/${workspaceSlug}/settings/projects/${activeProjectId}/members/`,
                  },
                  {
                    value: "activity",
                    label: "Activity",
                    icon: ClockCounterClockwiseIcon,
                    href: `/${workspaceSlug}/summon/projects/${activeProjectId}/`,
                  },
                  {
                    value: "notes",
                    label: "Notes",
                    icon: NoteIcon,
                    href: `/${workspaceSlug}/projects/${activeProjectId}/pages/`,
                  },
                ]}
                value="overview"
                label="Project preview navigation"
                className="mt-3 border-b-0"
              />
            </header>

            <div className="grid flex-1 content-start gap-3 p-4 lg:p-6 2xl:grid-cols-2">
              <PreviewCard title="Progress">
                <div className="flex items-baseline gap-2">
                  <strong className="text-3xl font-semibold text-primary tabular-nums">
                    {selectedProject.progress.percentage}%
                  </strong>
                  <span className="text-12 text-tertiary">complete</span>
                </div>
                <div
                  className="mt-3 h-1.5 overflow-hidden rounded-full bg-layer-3"
                  role="progressbar"
                  aria-valuenow={selectedProject.progress.percentage}
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  <div
                    className="h-full rounded-full bg-accent-primary transition-[width] duration-500"
                    style={{ width: `${selectedProject.progress.percentage}%` }}
                  />
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3 border-t border-dashed border-subtle pt-4">
                  <Info label="Current phase" value={selectedProject.profile?.phase || "Not set"} />
                  <Info label="Next milestone" value={selectedProject.milestones[0]?.name || "Not set"} />
                </div>
              </PreviewCard>
              <PreviewCard title="Details">
                <dl className="divide-y divide-dashed divide-subtle">
                  <InfoRow label="Project manager" value="Not available" />
                  <InfoRow label="Client" value={selectedClient?.company_name || "Not linked"} />
                  <InfoRow label="Start date" value={formatDate(selectedProject.profile?.start_date)} />
                  <InfoRow label="Target date" value={formatDate(selectedProject.profile?.target_date)} />
                  <InfoRow label="Budget" value={selectedProject.profile?.budget || "Not set"} />
                </dl>
              </PreviewCard>

              <PreviewCard title="Quick access" className="2xl:col-span-2">
                {selectedProject.resources.length ? (
                  <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                    {selectedProject.resources.slice(0, 5).map((resource) => (
                      <a
                        key={resource.id}
                        href={resource.url}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-2.5 rounded-lg border border-subtle p-2.5 hover:bg-layer-1"
                      >
                        <IconTile>
                          <FolderKanban className="size-3.5" />
                        </IconTile>
                        <span className="min-w-0">
                          <span className="block truncate text-13 font-medium text-primary">{resource.title}</span>
                          <span className="block truncate text-12 text-tertiary">{resource.category}</span>
                        </span>
                      </a>
                    ))}
                  </div>
                ) : (
                  <EmptyLine text="No resources linked to this project." />
                )}
              </PreviewCard>

              <PreviewCard title="Open tasks" href={`/${workspaceSlug}/projects/${activeProjectId}/issues/`}>
                {openIssues.length ? (
                  <div className="divide-y divide-dashed divide-subtle">
                    {openIssues.slice(0, 5).map((issue) => (
                      <Link
                        key={issue.id}
                        href={`/${workspaceSlug}/projects/${activeProjectId}/issues/${issue.id}/`}
                        className="flex items-center gap-2.5 py-2.5"
                      >
                        <Circle className="size-4 shrink-0 text-placeholder" />
                        <span className="min-w-0 flex-1 truncate text-13 text-primary">{issue.name}</span>
                        <StatusBadge status={issue.state?.group ?? "unstarted"} label={issue.state?.name || "Open"} />
                      </Link>
                    ))}
                  </div>
                ) : (
                  <EmptyLine text="No open tasks." />
                )}
              </PreviewCard>
              <PreviewCard title="Latest documents" href={`/${workspaceSlug}/projects/${activeProjectId}/pages/`}>
                {selectedProject.pages.length ? (
                  <div className="divide-y divide-dashed divide-subtle">
                    {selectedProject.pages.slice(0, 5).map((page) => (
                      <Link key={page.id} href={page.href} className="flex items-center gap-2.5 py-2.5">
                        <FileText className="size-4 shrink-0 text-tertiary" />
                        <span className="min-w-0 flex-1 truncate text-13 text-primary">{page.name}</span>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <EmptyLine text="No documents yet." />
                )}
              </PreviewCard>
            </div>

            <footer className="flex flex-wrap items-center gap-2 border-t border-subtle bg-surface-1 px-4 py-3 lg:px-6">
              <span className="mr-1 text-12 font-medium text-tertiary">Generate</span>
              {["Proposal", "Quotation", "MoM", "PPT", "Cost Projection"].map((label) => (
                <Link
                  key={label}
                  href={`/${workspaceSlug}/summon/automation/`}
                  className="inline-flex h-8 press items-center gap-1.5 rounded-lg border border-subtle bg-surface-1 px-2.5 text-13 font-medium text-secondary shadow-tactile hover:text-primary"
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
    <section className="mt-6">
      <div className="mb-1 flex items-center justify-between gap-3 px-2">
        <h2 className="text-12 font-medium text-tertiary">{props.title}</h2>
        <Link
          href={props.href}
          className="inline-flex items-center gap-0.5 text-12 font-medium text-tertiary hover:text-primary"
        >
          {props.action} <ChevronRight className="size-3.5" />
        </Link>
      </div>
      <div className="flex flex-col">
        {props.children}
        {!hasChildren && <EmptyLine text={props.empty} />}
      </div>
    </section>
  );
}

function PreviewCard(props: { title: string; href?: string; className?: string; children: React.ReactNode }) {
  return (
    <section className={`rounded-xl border border-subtle bg-surface-1 p-4 shadow-xs ${props.className || ""}`}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-13 font-semibold text-primary">{props.title}</h3>
        {props.href && (
          <Link
            href={props.href}
            className="inline-flex items-center gap-0.5 text-12 font-medium text-tertiary hover:text-primary"
          >
            See all <ChevronRight className="size-3.5" />
          </Link>
        )}
      </div>
      {props.children}
    </section>
  );
}

function ProjectMark({ identifier, size = "md" }: { identifier: string; size?: "md" | "lg" }) {
  return (
    <span
      className={`grid shrink-0 place-items-center rounded-full border border-accent-subtle bg-accent-subtle font-medium text-accent-primary ${size === "lg" ? "size-10 text-14" : "size-7 text-11"}`}
    >
      {identifier.slice(0, 2)}
    </span>
  );
}

function IconTile({ children }: { children: React.ReactNode }) {
  return (
    <span className="grid size-6 shrink-0 place-items-center rounded-md border border-subtle bg-layer-1 text-tertiary">
      {children}
    </span>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-12 text-tertiary">{label}</p>
      <p className="mt-0.5 text-13 font-medium text-primary">{value}</p>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2 first:pt-0 last:pb-0">
      <dt className="text-13 text-tertiary">{label}</dt>
      <dd className="text-right text-13 font-medium text-primary">{value}</dd>
    </div>
  );
}

function EmptyLine({ text }: { text: string }) {
  return <p className="rounded-lg bg-dot-grid px-3 py-5 text-center text-13 text-tertiary">{text}</p>;
}
