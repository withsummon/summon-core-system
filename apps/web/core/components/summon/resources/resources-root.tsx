/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import React, { useState, useMemo } from "react";
import useSWR from "swr";
import { Copy, ExternalLink, LayoutGrid, List, Plus, Trash2 } from "lucide-react";
import { useProject } from "@/hooks/store/use-project";
import { summonService } from "@/services/summon.service";
import { CategoryCardsRow } from "./category-cards-row";
import { RecentFilesCard } from "./recent-files-card";
import { CredentialsSidebarCard } from "./credentials-sidebar-card";
import { ResourceIcon } from "./resource-icon";
import { ResourceBadge } from "./resource-badge";
import {
  SummonPageHeader,
  SummonPagination,
  SummonTableShell,
  summonPageClassName,
  ViewPanel,
} from "@/components/summon/screen";
import { SummonSearchField } from "@/components/summon/search-field";
import { AddResourceModal } from "./add-resource-modal";
import type { ISummonResourceLink } from "@plane/types";
import type { TResourceViewMode, TResourceSortOption, ICreateResourcePayload, IResourceFilterState } from "./types";
import { EmptyStateDetailed } from "@plane/propel/empty-state";
import { Select } from "@plane/propel/select";
import { Button } from "@plane/propel/button";
import { Menu } from "@plane/propel/menu";
import { Tabs } from "@plane/propel/tabs";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";

interface IResourcesRootProps {
  workspaceSlug: string;
}

/** Column labels: the desktop header and the phone row label read from the same entry. */
const RESOURCE_COLUMNS = {
  name: "Name",
  project: "Project",
  type: "Type",
  lastUpdated: "Last updated",
  updatedBy: "Updated by",
} as const;

function formatRelativeTime(dateString: string): string {
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffHours < 1) return "Just now";
    if (diffHours < 24) return `${diffHours} ${diffHours === 1 ? "hour" : "hours"} ago`;
    if (diffDays < 30) return `${diffDays} ${diffDays === 1 ? "day" : "days"} ago`;
    return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
  } catch {
    return "Recently";
  }
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
              <div className="overflow-x-auto">
                <table className="table-stack w-full text-left text-13">
                  <thead>
                    <tr className="border-b border-subtle text-12 whitespace-nowrap text-tertiary">
                      <th className="px-3.5 py-2 font-medium">{RESOURCE_COLUMNS.name}</th>
                      <th className="px-3.5 py-2 font-medium">{RESOURCE_COLUMNS.project}</th>
                      <th className="px-3.5 py-2 font-medium">{RESOURCE_COLUMNS.type}</th>
                      <th className="px-3.5 py-2 font-medium">{RESOURCE_COLUMNS.lastUpdated}</th>
                      <th className="px-3.5 py-2 font-medium">{RESOURCE_COLUMNS.updatedBy}</th>
                      <th className="px-3.5 py-2">
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-subtle">
                    {paginatedResources.length > 0 ? (
                      paginatedResources.map((item) => {
                        const projectName = projectNameOf(item, projectsList);
                        const updatedBy =
                          item.updated_by_detail?.display_name || item.created_by_detail?.display_name || "Summon User";

                        return (
                          <tr key={item.id} className="transition-colors hover:bg-layer-1 max-md:relative">
                            <td className="w-full px-3.5 py-2.5 max-md:pr-10 md:max-w-0 md:min-w-48">
                              <a
                                href={item.url}
                                target="_blank"
                                rel="noreferrer"
                                className="flex min-w-0 items-center gap-2.5 font-medium text-primary hover:text-accent-primary"
                              >
                                <ResourceIcon
                                  category={item.category}
                                  title={item.title}
                                  url={item.url}
                                  className="size-4"
                                />
                                <span className="truncate" title={item.title}>
                                  {item.title}
                                </span>
                              </a>
                            </td>
                            <td
                              data-label={RESOURCE_COLUMNS.project}
                              className="truncate px-3.5 py-2.5 text-secondary md:max-w-36"
                            >
                              {projectName}
                            </td>
                            <td data-label={RESOURCE_COLUMNS.type} className="px-3.5 py-2.5">
                              <ResourceBadge category={item.category} />
                            </td>
                            <td
                              data-label={RESOURCE_COLUMNS.lastUpdated}
                              className="px-3.5 py-2.5 whitespace-nowrap text-secondary"
                            >
                              {formatRelativeTime(item.updated_at)}
                            </td>
                            <td data-label={RESOURCE_COLUMNS.updatedBy} className="px-3.5 py-2.5">
                              <span className="flex items-center gap-2 whitespace-nowrap text-primary">
                                <span
                                  aria-hidden="true"
                                  className="grid size-6 place-items-center rounded-full bg-layer-2 text-12 font-medium"
                                >
                                  {updatedBy.charAt(0).toUpperCase()}
                                </span>
                                <span className="max-w-[120px] truncate">{updatedBy}</span>
                              </span>
                            </td>
                            <td className="px-3.5 py-2.5 text-right max-md:absolute max-md:top-2 max-md:right-2 max-md:p-0!">
                              <Menu ellipsis placement="bottom-end" ariaLabel={`Actions for ${item.title}`}>
                                <Menu.MenuItem onClick={() => window.open(item.url, "_blank", "noopener,noreferrer")}>
                                  <ExternalLink aria-hidden="true" className="size-3.5 text-secondary" />
                                  Open link
                                </Menu.MenuItem>
                                <Menu.MenuItem onClick={() => handleCopyUrl(item.url)}>
                                  <Copy aria-hidden="true" className="size-3.5 text-secondary" />
                                  Copy URL
                                </Menu.MenuItem>
                                <Menu.MenuItem
                                  className="text-danger-primary"
                                  onClick={() => void handleDeleteResource(item.id)}
                                >
                                  <Trash2 aria-hidden="true" className="size-3.5" />
                                  Delete
                                </Menu.MenuItem>
                              </Menu>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={6} className="px-3.5 py-8 text-center text-12 text-tertiary">
                          Loading resources…
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 p-3.5 sm:grid-cols-2 lg:grid-cols-3">
                {paginatedResources.map((item) => (
                  <a
                    key={item.id}
                    href={item.url}
                    target="_blank"
                    rel="noreferrer"
                    className="group flex flex-col justify-between rounded-lg border border-subtle bg-layer-1 p-3.5 transition-colors hover:border-strong"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <ResourceIcon category={item.category} title={item.title} url={item.url} className="size-4" />
                        <ResourceBadge category={item.category} />
                      </div>
                      <h3 className="mt-3 line-clamp-2 text-13 font-medium text-primary group-hover:text-accent-primary">
                        {item.title}
                      </h3>
                      <p className="mt-0.5 line-clamp-1 text-12 text-tertiary">{projectNameOf(item, projectsList)}</p>
                    </div>
                    <div className="mt-3 flex items-center justify-between border-t border-subtle pt-2 text-12 text-tertiary">
                      <span>{formatRelativeTime(item.updated_at)}</span>
                      <ExternalLink aria-hidden="true" className="size-3 text-secondary" />
                    </div>
                  </a>
                ))}
              </div>
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

function projectNameOf(item: ISummonResourceLink, projects: { id: string; name: string }[]) {
  return item.project_detail?.name || projects.find((p) => p.id === item.project)?.name || "Global Resource";
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
