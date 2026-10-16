/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import { SquaresFourIcon } from "@phosphor-icons/react";
import useSWR from "swr";
import { BookOpen, Settings, Sparkles } from "lucide-react";
import { Button, getButtonStyling } from "@plane/propel/button";
import { PageHead } from "@/components/core/page-title";
import { SummonRequestState } from "@/components/summon/request-state";
import { SummonDrawer } from "@/components/summon/drawer";
import { SectionTabs } from "@/components/summon/section-tabs";
import {
  SummonPageHeader,
  SummonPagination,
  summonPageClassName,
  ViewPanel,
  SummonPanel,
  SummonSectionHeader,
} from "@/components/summon/screen";
import { useHashTab } from "@/components/summon/use-hash-tab";
import { useProject } from "@/hooks/store/use-project";
import { summonService } from "@/services/summon.service";
import { SummonSearchField } from "@/components/summon/search-field";
import type { Route } from "./+types/page";
import { filterAutomationJobs } from "./automation-form";
import { orderedTemplates, templateLabel, templateTabIcon } from "./automation-display";
import { AutomationGeneratorForm } from "./automation-generator-form";
import { AutomationJobsTable, AutomationJobsTableSkeleton } from "./automation-jobs-table";
import { AutomationTemplateGrid, AutomationTemplateGridSkeleton } from "./automation-template-grid";
import { useAutomationGenerator } from "./use-automation-generator";

const PAGE_SIZE = 8;

export default function SummonAutomationPage({ params }: Route.ComponentProps) {
  const { workspaceSlug } = params;
  const { joinedProjectIds, getProjectById } = useProject();
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [meetingId, setMeetingId] = useState("");
  const { data, error, isLoading, mutate } = useSWR(
    ["summon-automation", workspaceSlug],
    async () => {
      const [templates, jobs, clients, meetings, pages] = await Promise.all([
        summonService.listAutomationTemplates(workspaceSlug),
        summonService.listAutomationJobs(workspaceSlug),
        summonService.listClients(workspaceSlug),
        summonService.listMeetings(workspaceSlug),
        summonService.listPageContexts(workspaceSlug),
      ]);
      return { templates, jobs, clients, meetings, pages };
    },
    {
      refreshInterval: (current) =>
        current?.meetings.find(({ id }) => id === meetingId)?.summary_error === "transcribing" ? 3000 : 0,
    }
  );
  const jobs = useMemo(() => data?.jobs ?? [], [data?.jobs]);
  const templates = useMemo(() => orderedTemplates(data?.templates ?? []), [data?.templates]);
  const generator = useAutomationGenerator({
    workspaceSlug,
    templates,
    meetings: data?.meetings,
    meetingId,
    refresh: mutate,
  });
  const projectNames = useMemo(
    () => new Map(joinedProjectIds.map((id) => [id, getProjectById(id)?.name ?? id])),
    [getProjectById, joinedProjectIds]
  );
  const typeTabs = useMemo(() => {
    const types = Array.from(new Set([...templates.map(({ type }) => type), ...jobs.map(({ type }) => type)]));
    return [
      { value: "all", label: "All", icon: SquaresFourIcon },
      ...types.slice(0, 6).map((type) => ({ value: type, label: templateLabel(type), icon: templateTabIcon(type) })),
    ];
  }, [jobs, templates]);
  const [activeType, selectType] = useHashTab(typeTabs.map((tab) => tab.value));
  const filteredJobs = useMemo(
    () => filterAutomationJobs(jobs, projectNames, query, activeType),
    [activeType, jobs, projectNames, query]
  );
  const pageCount = Math.max(1, Math.ceil(filteredJobs.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pagedJobs = filteredJobs.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  return (
    <section className={summonPageClassName}>
      <PageHead title="Automation Studio · Summon Core" />
      <SummonPageHeader
        title="Automation Studio"
        description="Generate documents and automate routine work"
        actions={
          <>
            <SummonSearchField
              label="Search templates and documents"
              placeholder="Search"
              value={query}
              onValueChange={setQuery}
              className="w-full sm:w-80"
            />
            <Link href={`/${workspaceSlug}/summon/knowledge/`} className={getButtonStyling("secondary", "lg")}>
              <BookOpen />
              Knowledge
            </Link>
            <Link href={`/${workspaceSlug}/summon/settings/`} className={getButtonStyling("secondary", "lg")}>
              <Settings />
              Settings
            </Link>
            <Button size="lg" onClick={() => generator.openGenerator()}>
              <Sparkles />
              New document
            </Button>
          </>
        }
      />

      <section className="mt-8">
        <SummonSectionHeader title="Templates" count={data ? templates.length : undefined} className="mb-3" />
        <SummonRequestState
          loading={isLoading}
          skeleton={<AutomationTemplateGridSkeleton />}
          error={error}
          empty={!isLoading && templates.length === 0}
          emptyAsset="automation"
          emptyTitle="No templates yet"
          emptyMessage="Document templates you can generate from show up here."
          onRetry={() => void mutate()}
        />
        <AutomationTemplateGrid
          templates={templates}
          selectedTemplateId={generator.template}
          onOpen={generator.openGenerator}
        />
      </section>

      <div className="mt-4">
        <SummonPanel flush title="Generated documents" count={data ? filteredJobs.length : undefined}>
          <SectionTabs
            items={typeTabs}
            value={activeType}
            onValueChange={(type) => {
              selectType(type);
              setPage(1);
            }}
            label="Generated document types"
            className="px-4"
          />
          <ViewPanel value={activeType}>
            <SummonRequestState
              loading={isLoading}
              skeleton={<AutomationJobsTableSkeleton />}
              error={error}
              empty={!isLoading && filteredJobs.length === 0}
              emptyAsset="automation"
              emptyTitle="No generated documents yet"
              emptyMessage="Pick a template above to generate your first document."
              onRetry={() => void mutate()}
            />
            {filteredJobs.length > 0 && (
              <>
                <AutomationJobsTable jobs={pagedJobs} workspaceSlug={workspaceSlug} projectNames={projectNames} />
                <SummonPagination
                  page={currentPage}
                  pageSize={PAGE_SIZE}
                  total={filteredJobs.length}
                  noun="documents"
                  onPageChange={setPage}
                />
              </>
            )}
          </ViewPanel>
        </SummonPanel>
      </div>

      <SummonDrawer
        open={generator.generatorOpen}
        onOpenChange={generator.setGeneratorOpen}
        title="Generate a document"
        description="Preview first; files and pages are created only when you publish."
      >
        <AutomationGeneratorForm
          generator={generator}
          templateOptions={(data?.templates ?? []).map((item) => ({ value: item.id, label: item.name }))}
          projectOptions={joinedProjectIds.map((id) => ({ value: id, label: getProjectById(id)?.name ?? id }))}
          meetings={data?.meetings ?? []}
          clients={data?.clients ?? []}
          pages={data?.pages ?? []}
          meetingId={meetingId}
          onMeetingChange={setMeetingId}
        />
      </SummonDrawer>
    </section>
  );
}
