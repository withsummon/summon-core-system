/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { ArrowUpRight, CheckCircle2, Circle, FileText, FolderGit2, Globe2, Sparkles } from "lucide-react";
import { observer } from "mobx-react";
import { Link } from "react-router";
import useSWR from "swr";
import { SummonCard, SummonScreen } from "@/components/summon/screen";
import { SummonRequestState } from "@/components/summon/request-state";
import { useProject } from "@/hooks/store/use-project";
import { useUser } from "@/hooks/store/user";
import { summonService } from "@/services/summon.service";
import type { Route } from "./+types/page";

const SectionTitle = ({ children, href }: { children: React.ReactNode; href?: string }) => (
  <div className="mb-2.5 flex items-center justify-between gap-3">
    <h2 className="text-xs font-semibold text-primary">{children}</h2>
    {href && (
      <Link to={href} className="text-[10px] font-medium text-accent-primary">
        See all →
      </Link>
    )}
  </div>
);

function SummonOverviewPage({ params }: Route.ComponentProps) {
  const { workspaceSlug } = params;
  const { data: user } = useUser();
  const { joinedProjectIds, getProjectById } = useProject();
  const { data, error, isLoading, mutate } = useSWR(["summon-command-center", workspaceSlug], async () => {
    const [report, opportunities, resources] = await Promise.all([
      summonService.getReport(workspaceSlug),
      summonService.listOpportunities(workspaceSlug),
      summonService.listResources(workspaceSlug),
    ]);
    return { report, opportunities, resources };
  });

  if (!data) return <SummonRequestState loading={isLoading} error={error} onRetry={() => void mutate()} />;

  const { report, opportunities, resources } = data;
  const projects = joinedProjectIds.map(getProjectById).filter(Boolean);
  const featuredProject = projects[0];
  const completion = report.issues.total ? Math.round((report.issues.completed / report.issues.total) * 100) : 0;
  const firstName = (user?.display_name || user?.first_name || "there").split(" ")[0];
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  return (
    <SummonScreen title={`${greeting}, ${firstName}!`} description="Here's what's happening across your workspace.">
      <div className="relative grid items-start gap-4 xl:grid-cols-[minmax(17rem,0.72fr)_minmax(0,1.7fr)]">
        <div className="space-y-4">
          <SummonCard>
            <SectionTitle href={`/${workspaceSlug}/workspace-views/all-issues/`}>Priority</SectionTitle>
            <div className="rounded-xl border border-subtle bg-layer-1 p-3">
              <div className="flex items-center gap-2.5">
                <span className="grid size-8 place-items-center rounded-lg bg-danger-subtle text-danger-primary">
                  <Circle className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs truncate font-medium text-primary">Overdue work items</p>
                  <p className="mt-0.5 text-[10px] text-secondary">Across accessible Plane projects</p>
                </div>
                <span className="rounded-full bg-danger-subtle px-2 py-1 text-[10px] font-semibold text-danger-primary">
                  {report.issues.overdue}
                </span>
              </div>
            </div>
          </SummonCard>

          <SummonCard>
            <SectionTitle href={`/${workspaceSlug}/projects/`}>Active Projects</SectionTitle>
            <div className="divide-y divide-subtle">
              {projects.slice(0, 5).map(
                (project) =>
                  project && (
                    <Link
                      key={project.id}
                      to={`/${workspaceSlug}/projects/${project.id}/issues/`}
                      className="flex items-center gap-2.5 py-2 first:pt-0 last:pb-0"
                    >
                      <span className="grid size-7 place-items-center rounded-lg bg-accent-subtle text-[10px] font-semibold text-accent-primary">
                        {project.identifier?.slice(0, 2)}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-[11px] font-medium text-primary">
                        {project.name}
                      </span>
                      <span className="rounded-full bg-success-subtle px-2 py-0.5 text-[9px] text-success-primary">
                        On Going
                      </span>
                    </Link>
                  )
              )}
              {!projects.length && <p className="py-3 text-center text-[11px] text-tertiary">No projects yet</p>}
            </div>
          </SummonCard>

          <SummonCard>
            <SectionTitle href={`/${workspaceSlug}/summon/opportunities`}>Opportunities</SectionTitle>
            <div className="divide-y divide-subtle">
              {opportunities.slice(0, 4).map((item) => (
                <Link
                  key={item.id}
                  to={`/${workspaceSlug}/summon/opportunities`}
                  className="flex items-center gap-2.5 py-2 first:pt-0 last:pb-0"
                >
                  <span className="text-xs grid size-7 place-items-center rounded-lg bg-success-subtle text-success-primary">
                    ◇
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[11px] font-medium text-primary">{item.title}</span>
                  <span className="rounded-full bg-accent-subtle px-2 py-0.5 text-[9px] text-accent-primary">
                    {item.stage}
                  </span>
                </Link>
              ))}
              {!opportunities.length && (
                <p className="py-3 text-center text-[11px] text-tertiary">No opportunities yet</p>
              )}
            </div>
          </SummonCard>
        </div>

        <div className="space-y-4">
          <SummonCard className="p-0!">
            <div className="flex flex-wrap items-center gap-3 border-b border-subtle p-4">
              <span className="text-xs grid size-10 place-items-center rounded-xl bg-accent-subtle font-semibold text-accent-primary">
                {featuredProject?.identifier?.slice(0, 2) || "SC"}
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="text-sm truncate font-semibold text-primary">
                  {featuredProject?.name || "Summon Core Workspace"}
                </h2>
                <p className="mt-0.5 text-[10px] text-secondary">
                  {projects.length} active projects · {report.issues.total} work items
                </p>
              </div>
              {featuredProject && (
                <Link
                  to={`/${workspaceSlug}/projects/${featuredProject.id}/issues/`}
                  className="flex h-9 items-center gap-2 rounded-xl bg-accent-primary px-3 text-[10px] font-semibold text-on-color"
                >
                  Open Workspace <ArrowUpRight className="size-3.5" />
                </Link>
              )}
            </div>
            <div className="flex gap-5 overflow-x-auto border-b border-subtle px-4 pt-3 text-[10px] font-medium text-secondary">
              {["Overview", "Tasks", "Documents", "Access", "Activity", "Notes"].map((tab, index) => (
                <span
                  key={tab}
                  className={index === 0 ? "border-accent-primary border-b-2 pb-3 text-accent-primary" : "pb-3"}
                >
                  {tab}
                </span>
              ))}
            </div>
            <div className="grid gap-3 p-4 lg:grid-cols-2">
              <div className="rounded-2xl border border-subtle p-3.5">
                <p className="text-xs font-semibold text-primary">Project Progress</p>
                <div className="mt-4 flex items-end gap-2">
                  <strong className="text-3xl text-primary">{completion}%</strong>
                  <span className="pb-1 text-[10px] text-secondary">Overall Progress</span>
                </div>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-layer-2">
                  <div className="h-full rounded-full bg-accent-primary" style={{ width: `${completion}%` }} />
                </div>
                <div className="mt-4 grid grid-cols-2 border-t border-subtle pt-3 text-[10px]">
                  <div>
                    <p className="text-tertiary">Completed</p>
                    <p className="mt-1 font-semibold text-primary">{report.issues.completed} tasks</p>
                  </div>
                  <div>
                    <p className="text-tertiary">Open</p>
                    <p className="mt-1 font-semibold text-primary">
                      {Math.max(report.issues.total - report.issues.completed, 0)} tasks
                    </p>
                  </div>
                </div>
              </div>
              <div className="rounded-2xl border border-subtle p-3.5">
                <p className="text-xs font-semibold text-primary">Workspace Info</p>
                <dl className="mt-3 space-y-2.5 text-[10px]">
                  {[
                    ["Projects", report.projects],
                    ["Clients", report.commercial.clients],
                    ["Meetings", report.meetings],
                    ["Automation jobs", report.automation.jobs],
                  ].map(([label, value]) => (
                    <div key={label} className="flex justify-between gap-4">
                      <dt className="text-tertiary">{label}</dt>
                      <dd className="font-medium text-primary">{value}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            </div>
            <div className="mx-4 mb-4 rounded-2xl border border-subtle p-3.5">
              <SectionTitle href={`/${workspaceSlug}/summon/resources`}>Quick Access</SectionTitle>
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                {resources.slice(0, 4).map((item) => (
                  <a
                    key={item.id}
                    href={item.url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex min-w-0 items-center gap-2 rounded-xl border border-subtle bg-layer-1 p-2.5"
                  >
                    <FolderGit2 className="size-4 shrink-0 text-accent-primary" />
                    <span className="min-w-0 truncate text-[10px] font-medium text-primary">{item.title}</span>
                  </a>
                ))}
                {!resources.length && (
                  <Link
                    to={`/${workspaceSlug}/summon/resources`}
                    className="col-span-full rounded-xl border border-dashed border-subtle p-3 text-center text-[10px] text-tertiary"
                  >
                    Add your first resource
                  </Link>
                )}
              </div>
            </div>
          </SummonCard>

          <div className="grid gap-4 lg:grid-cols-2">
            <SummonCard>
              <SectionTitle href={`/${workspaceSlug}/workspace-views/all-issues/`}>Open Tasks</SectionTitle>
              <div className="space-y-2.5">
                {[
                  ["Completed", report.issues.completed, CheckCircle2],
                  ["Open", Math.max(report.issues.total - report.issues.completed, 0), Circle],
                  ["Overdue", report.issues.overdue, Circle],
                ].map(([label, value, Icon]) => (
                  <div key={label} className="flex items-center gap-2 text-[11px]">
                    <Icon className="size-4 text-accent-primary" />
                    <span className="flex-1 text-secondary">{label}</span>
                    <strong className="text-primary">{value}</strong>
                  </div>
                ))}
              </div>
            </SummonCard>
            <SummonCard>
              <SectionTitle>Knowledge</SectionTitle>
              <div className="space-y-2.5">
                <div className="flex items-center gap-2 text-[11px]">
                  <FileText className="size-4 text-accent-primary" />
                  <span className="flex-1 text-secondary">Knowledge pages</span>
                  <strong className="text-primary">{report.knowledge.pages}</strong>
                </div>
                <div className="flex items-center gap-2 text-[11px]">
                  <Globe2 className="size-4 text-success-primary" />
                  <span className="flex-1 text-secondary">External resources</span>
                  <strong className="text-primary">{resources.length}</strong>
                </div>
              </div>
            </SummonCard>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
            {["Proposal", "Quotation", "MoM", "PPT", "Cost Projection"].map((label) => (
              <Link
                key={label}
                to={`/${workspaceSlug}/summon/automation`}
                className="flex items-center gap-2 rounded-xl border border-subtle bg-surface-1 p-3 text-[10px] font-medium text-primary"
              >
                <Sparkles className="size-4 text-accent-primary" />
                {label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </SummonScreen>
  );
}

export default observer(SummonOverviewPage);
