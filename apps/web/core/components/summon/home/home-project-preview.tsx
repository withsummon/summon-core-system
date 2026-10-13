/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { useMemo } from "react";
import Link from "next/link";
import {
  CheckSquareIcon,
  ClockCounterClockwiseIcon,
  FileTextIcon,
  NoteIcon,
  SquaresFourIcon,
  UsersThreeIcon,
} from "@phosphor-icons/react";
import { ArrowRight, Circle, FileText, FolderKanban, Sparkles } from "lucide-react";
import type { ISummonClientDetail, ISummonProjectOverview } from "@plane/types";
import { SectionTabs } from "@/components/summon/section-tabs";
import { StatusBadge } from "@/components/summon/status-badge";
import { EmptyLine, IconTile, Info, InfoRow, PreviewCard, ProjectMark } from "./home-parts";

const DATE_FORMATTER = new Intl.DateTimeFormat("en", { day: "2-digit", month: "short", year: "numeric" });

const formatDate = (value?: string | null) => {
  if (!value) return "Not set";
  return DATE_FORMATTER.format(new Date(value));
};

type THomeProjectPreviewProps = {
  workspaceSlug: string;
  activeProjectId: string;
  projectLoading: boolean;
  selectedProject: ISummonProjectOverview | undefined;
  selectedClient: ISummonClientDetail | undefined;
  money: (value: string | null | undefined) => string;
};

type TPreviewProps = {
  workspaceSlug: string;
  activeProjectId: string;
  selectedProject: ISummonProjectOverview;
  selectedClient: ISummonClientDetail | undefined;
};

function PreviewHeader({ workspaceSlug, activeProjectId, selectedProject, selectedClient }: TPreviewProps) {
  return (
    <header className="border-b border-subtle bg-surface-1 px-4 pt-4 lg:px-6 lg:pt-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <ProjectMark identifier={selectedProject.project.identifier} size="lg" />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="truncate text-xl font-semibold text-primary" title={selectedProject.project.name}>
                {selectedProject.project.name}
              </h2>
              <StatusBadge status={selectedProject.profile?.delivery_status || "not_assessed"} />
            </div>
            <p className="mt-0.5 text-13 text-tertiary">Client · {selectedClient?.company_name || "Not linked"}</p>
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
            href: `/${workspaceSlug}/summon/projects/${activeProjectId}/#activity`,
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
  );
}

function PreviewSummaryCards(
  props: Omit<TPreviewProps, "workspaceSlug" | "activeProjectId"> & Pick<THomeProjectPreviewProps, "money">
) {
  const { selectedProject, selectedClient, money } = props;
  const startDateValue = selectedProject.profile?.start_date;
  const targetDateValue = selectedProject.profile?.target_date;
  const { startDate, targetDate } = useMemo(
    () => ({ startDate: formatDate(startDateValue), targetDate: formatDate(targetDateValue) }),
    [startDateValue, targetDateValue]
  );

  return (
    <>
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
          <InfoRow label="Start date" value={startDate} />
          <InfoRow label="Target date" value={targetDate} />
          <InfoRow label="Budget" value={money(selectedProject.profile?.budget) || "Not set"} />
        </dl>
      </PreviewCard>
    </>
  );
}

function PreviewListCards({ workspaceSlug, activeProjectId, selectedProject }: Omit<TPreviewProps, "selectedClient">) {
  const openIssues = selectedProject.issues.filter((issue) => !issue.completed);

  return (
    <>
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
                  <span className="block truncate text-13 font-medium text-primary" title={resource.title}>
                    {resource.title}
                  </span>
                  <span className="block truncate text-12 text-tertiary">{resource.category}</span>
                </span>
              </a>
            ))}
          </div>
        ) : (
          <EmptyLine asset="link" text="No resources linked to this project." />
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
                <span className="min-w-0 flex-1 truncate text-13 text-primary" title={issue.name}>
                  {issue.name}
                </span>
                <StatusBadge status={issue.state?.group ?? "unstarted"} label={issue.state?.name || "Open"} />
              </Link>
            ))}
          </div>
        ) : (
          <EmptyLine asset="work-item" text="No open tasks." />
        )}
      </PreviewCard>
      <PreviewCard title="Latest documents" href={`/${workspaceSlug}/projects/${activeProjectId}/pages/`}>
        {selectedProject.pages.length ? (
          <div className="divide-y divide-dashed divide-subtle">
            {selectedProject.pages.slice(0, 5).map((page) => (
              <Link key={page.id} href={page.href} className="flex items-center gap-2.5 py-2.5">
                <FileText className="size-4 shrink-0 text-tertiary" />
                <span className="min-w-0 flex-1 truncate text-13 text-primary" title={page.name}>
                  {page.name}
                </span>
              </Link>
            ))}
          </div>
        ) : (
          <EmptyLine asset="note" text="No documents yet." />
        )}
      </PreviewCard>
    </>
  );
}

export function HomeProjectPreview(props: THomeProjectPreviewProps) {
  const { workspaceSlug, activeProjectId, projectLoading, selectedProject, selectedClient, money } = props;

  return (
    <section className="hidden min-w-0 bg-canvas xl:block">
      {projectLoading || !selectedProject ? (
        <div className="grid min-h-[32rem] place-items-center bg-dot-grid p-8 text-13 text-tertiary">
          {activeProjectId ? "Loading project workspace…" : "Select an active project to preview it here."}
        </div>
      ) : (
        <div className="flex min-h-full flex-col">
          <PreviewHeader
            workspaceSlug={workspaceSlug}
            activeProjectId={activeProjectId}
            selectedProject={selectedProject}
            selectedClient={selectedClient}
          />

          <div className="grid flex-1 content-start gap-3 p-4 lg:p-6 2xl:grid-cols-2">
            <PreviewSummaryCards selectedProject={selectedProject} selectedClient={selectedClient} money={money} />
            <PreviewListCards
              workspaceSlug={workspaceSlug}
              activeProjectId={activeProjectId}
              selectedProject={selectedProject}
            />
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
  );
}
