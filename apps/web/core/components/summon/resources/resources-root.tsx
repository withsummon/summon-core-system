/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import React, { useState, useMemo } from "react";
import useSWR from "swr";
import { LayoutGrid, List, Plus } from "lucide-react";
import { useProject } from "@/hooks/store/use-project";
import { summonService } from "@/services/summon.service";
import { CategoryCardsRow } from "./category-cards-row";
import { RecentFilesCard } from "./recent-files-card";
import { CredentialsSidebarCard } from "./credentials-sidebar-card";
import {
  SummonPageHeader,
  SummonPagination,
  SummonTableShell,
  summonPageClassName,
  ViewPanel,
} from "@/components/summon/screen";
import { SummonSearchField } from "@/components/summon/search-field";
import { AddResourceModal } from "./add-resource-modal";
import { ResourcesGrid, ResourcesTable } from "./resources-views";
import type { ISummonResourceLink } from "@plane/types";
import type { TResourceViewMode, TResourceSortOption, ICreateResourcePayload, IResourceFilterState } from "./types";
import { EmptyStateDetailed } from "@plane/propel/empty-state";
import { Select } from "@plane/propel/select";
import { Button } from "@plane/propel/button";
import { Tabs } from "@plane/propel/tabs";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";

interface IResourcesRootProps {
  workspaceSlug: string;
}

/** Category tiles also catch links whose category was left generic, by file extension or host. */
const CATEGORY_MATCHES: Record<string, (category: string, title: string, url: string) => boolean> = {
  document: (category, title) => category === "document" || category === "page" || /\.(pdf|docx|xlsx)$/.test(title),
  repository: (category, _title, url) =>
    category === "repository" || url.includes("github.com") || url.includes("gitlab.com"),
  figma: (category, _title, url) => category === "figma" || url.includes("figma.com"),
  deployment: (category, _title, url) =>
    category === "deployment" || url.includes("withsummon.com") || url.includes(".app"),
  drive: (category, _title, url) => category === "drive" || url.includes("drive.google.com"),
  recording: (category, title) => category === "recording" || /\.(mp4|mov)$/.test(title),
  account: (category) => category === "account" || category === "credential",
};

const RESOURCE_SORTS: Partial<Record<TResourceSortOption, (a: ISummonResourceLink, b: ISummonResourceLink) => number>> =
  {
    recently_updated: (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
    name_asc: (a, b) => a.title.localeCompare(b.title),
    name_desc: (a, b) => b.title.localeCompare(a.title),
  };

function filterResources(resources: ISummonResourceLink[], filters: IResourceFilterState) {
  const query = filters.searchQuery.toLowerCase().trim();
  const category = filters.selectedCategory;
  const matchesCategory = CATEGORY_MATCHES[category] ?? ((resourceCategory: string) => resourceCategory === category);
  const list = resources.filter(
    (r) =>
      (!query ||
        [r.title, r.url, r.project_detail?.name ?? "", r.category].some((text) =>
          text.toLowerCase().includes(query)
        )) &&
      (category === "all" || matchesCategory(r.category.toLowerCase(), r.title.toLowerCase(), r.url.toLowerCase())) &&
      (filters.selectedProject === "all" || r.project === filters.selectedProject)
  );
  const compare = RESOURCE_SORTS[filters.sortBy];
  if (compare) list.sort(compare);
  return list;
}

export function ResourcesRoot({ workspaceSlug }: IResourcesRootProps) {
  const { joinedProjectIds, getProjectById } = useProject();

  // 1. Live Data Fetching from Database API
  const {
    data: resources = [],
    isLoading: isResourcesLoading,
    mutate: mutateResources,
  } = useSWR(["summon-resources", workspaceSlug], () => summonService.listResources(workspaceSlug));

  const { data: credentials = [] } = useSWR(["summon-credentials", workspaceSlug], () =>
    summonService.listCredentials(workspaceSlug)
  );

  // 2. State & Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedProjectId, setSelectedProjectId] = useState("all");
  const [viewMode, setViewMode] = useState<TResourceViewMode>("list");
  const [sortBy, setSortBy] = useState<TResourceSortOption>("recently_updated");
  const [currentPage, setCurrentPage] = useState(1);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  const projectsList = useMemo(
    () => joinedProjectIds.map((id) => ({ id, name: getProjectById(id)?.name || id })),
    [joinedProjectIds, getProjectById]
  );

  // 3. Filter and Sort logic on live DB records
  const filteredResources = useMemo(
    () =>
      filterResources(resources, {
        searchQuery,
        selectedCategory,
        selectedProject: selectedProjectId,
        sortBy,
      }),
    [resources, searchQuery, selectedCategory, selectedProjectId, sortBy]
  );

  // 4. Pagination
  const pageSize = 10;
  const totalItems = filteredResources.length;
  const hasFilters = Boolean(searchQuery.trim()) || selectedCategory !== "all" || selectedProjectId !== "all";
  const clearFilters = () => {
    setSearchQuery("");
    setSelectedCategory("all");
    setSelectedProjectId("all");
  };
  const paginatedResources = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredResources.slice(start, start + pageSize);
  }, [filteredResources, currentPage, pageSize]);

  // 5. Actions
  const handleSaveResource = async (payload: ICreateResourcePayload) => {
    await summonService.createResource(workspaceSlug, payload);
    await mutateResources();
  };

  const handleDeleteResource = async (id: string) => {
    if (confirm("Are you sure you want to delete this resource?")) {
      await summonService.deleteResource(workspaceSlug, id);
      await mutateResources();
    }
  };

  const handleCopyUrl = (url: string) => {
    void navigator.clipboard.writeText(url);
    setToast({ type: TOAST_TYPE.INFO, title: "URL copied", message: "Resource link copied to clipboard." });
  };

  return (
    <div className={summonPageClassName}>
      <SummonPageHeader
        title="Resources"
        description="Project assets, links and files in one place"
        actions={
          <Button size="lg" prependIcon={<Plus aria-hidden="true" />} onClick={() => setIsAddModalOpen(true)}>
            Add resource
          </Button>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <SummonSearchField
          label="Search resources"
          placeholder="Search resources by name, project, type, or keyword…"
          value={searchQuery}
          onValueChange={(value) => {
            setSearchQuery(value);
            setCurrentPage(1);
          }}
          className="max-w-2xl min-w-64 flex-1"
        />
        <Select
          aria-label="Filter resources by project"
          value={selectedProjectId}
          onValueChange={(value) => {
            setSelectedProjectId(value);
            setCurrentPage(1);
          }}
          className="w-auto min-w-44"
          options={[
            { value: "all", label: "All projects" },
            ...projectsList.map((p) => ({ value: p.id, label: p.name })),
          ]}
        />
      </div>

      <CategoryCardsRow
        resources={resources}
        credentialCount={credentials.length}
        selectedCategory={selectedCategory}
        onSelectCategory={(cat) => {
          setSelectedCategory(cat);
          setCurrentPage(1);
        }}
      />

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <SummonTableShell
          filters={
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-primary">
                All resources
                <span className="rounded-sm bg-layer-1 px-1.5 py-0.5 text-12 font-medium text-secondary tabular-nums ring ring-subtle ring-inset">
                  {totalItems}
                </span>
              </h2>
              <div className="flex items-center gap-2">
                <Select
                  aria-label="Sort resources"
                  value={sortBy}
                  onValueChange={(value) => setSortBy(value as TResourceSortOption)}
                  className="h-8 w-auto min-w-40"
                  options={[
                    { value: "recently_updated", label: "Recently updated" },
                    { value: "name_asc", label: "Name (A–Z)" },
                    { value: "name_desc", label: "Name (Z–A)" },
                  ]}
                />
                <Tabs value={viewMode} onValueChange={(value) => setViewMode(value as TResourceViewMode)}>
                  <Tabs.List aria-label="Resource view">
                    <Tabs.Trigger value="list" size="sm" aria-label="List view">
                      <List aria-hidden="true" className="size-4" />
                    </Tabs.Trigger>
                    <Tabs.Trigger value="grid" size="sm" aria-label="Grid view">
                      <LayoutGrid aria-hidden="true" className="size-4" />
                    </Tabs.Trigger>
                  </Tabs.List>
                </Tabs>
              </div>
            </div>
          }
        >
          <ViewPanel value={selectedCategory}>
            {!isResourcesLoading && totalItems === 0 ? (
              <ResourcesEmptyState
                hasFilters={hasFilters}
                onClearFilters={clearFilters}
                onAdd={() => setIsAddModalOpen(true)}
              />
            ) : viewMode === "list" ? (
              <ResourcesTable
                resources={paginatedResources}
                projectsList={projectsList}
                onCopyUrl={handleCopyUrl}
                onDelete={(id) => void handleDeleteResource(id)}
              />
            ) : (
              <ResourcesGrid resources={paginatedResources} projectsList={projectsList} />
            )}
          </ViewPanel>

          <SummonPagination
            page={currentPage}
            pageSize={pageSize}
            total={totalItems}
            noun="resources"
            onPageChange={setCurrentPage}
          />
        </SummonTableShell>

        <div className="flex flex-col gap-4">
          <RecentFilesCard
            resources={resources}
            onSelectCategory={(cat) => {
              setSelectedCategory(cat);
              setCurrentPage(1);
            }}
          />
          <CredentialsSidebarCard credentials={credentials} workspaceSlug={workspaceSlug} />
        </div>
      </div>

      <AddResourceModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSave={handleSaveResource}
        projects={projectsList}
      />
    </div>
  );
}

function ResourcesEmptyState(props: { hasFilters: boolean; onClearFilters: () => void; onAdd: () => void }) {
  const copy = props.hasFilters
    ? ({
        assetKey: "search",
        title: "No matching resources",
        description: "Try another search, category or project.",
        action: { label: "Clear filters", variant: "secondary", onClick: props.onClearFilters },
      } as const)
    : ({
        assetKey: "page",
        title: "No resources yet",
        description: "Add links to documents, repositories, designs and drives so the team finds them in one place.",
        action: { label: "Add resource", onClick: props.onAdd },
      } as const);
  return (
    <EmptyStateDetailed
      align="center"
      rootClassName="px-6 py-12"
      assetClassName="h-auto w-32"
      assetKey={copy.assetKey}
      title={copy.title}
      description={copy.description}
      actions={[copy.action]}
    />
  );
}
