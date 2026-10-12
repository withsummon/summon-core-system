/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import React, { useState, useMemo } from "react";
import useSWR from "swr";
import {
  Search,
  Filter,
  ChevronDown,
  List,
  LayoutGrid,
  MoreHorizontal,
  Plus,
  ExternalLink,
  Trash2,
  Copy,
  Check,
} from "lucide-react";
import { useProject } from "@/hooks/store/use-project";
import { summonService } from "@/services/summon.service";
import { CategoryCardsRow } from "./category-cards-row";
import { RecentFilesCard } from "./recent-files-card";
import { CredentialsSidebarCard } from "./credentials-sidebar-card";
import { ResourceIcon } from "./resource-icon";
import { ResourceBadge } from "./resource-badge";
import { SummonPageHeader, summonPageClassName } from "@/components/summon/screen";
import { AddResourceModal } from "./add-resource-modal";
import type { TResourceViewMode, TResourceSortOption, ICreateResourcePayload } from "./types";
import { EmptyStateDetailed } from "@plane/propel/empty-state";
import { Select } from "@plane/propel/select";
import { FIELD_CLASSNAME } from "@plane/propel/input";

interface IResourcesRootProps {
  workspaceSlug: string;
}

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
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  const projectsList = useMemo(
    () => joinedProjectIds.map((id) => ({ id, name: getProjectById(id)?.name || id })),
    [joinedProjectIds, getProjectById]
  );

  // 3. Filter and Sort logic on live DB records
  const filteredResources = useMemo(() => {
    let list = [...resources];

    // Search query filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (r) =>
          r.title.toLowerCase().includes(q) ||
          r.url.toLowerCase().includes(q) ||
          (r.project_detail?.name && r.project_detail.name.toLowerCase().includes(q)) ||
          r.category.toLowerCase().includes(q)
      );
    }

    // Category filter
    if (selectedCategory !== "all") {
      list = list.filter((r) => {
        const cat = r.category.toLowerCase();
        const title = r.title.toLowerCase();
        const url = r.url.toLowerCase();

        if (selectedCategory === "document") {
          return (
            cat === "document" ||
            cat === "page" ||
            title.endsWith(".pdf") ||
            title.endsWith(".docx") ||
            title.endsWith(".xlsx")
          );
        }
        if (selectedCategory === "repository") {
          return cat === "repository" || url.includes("github.com") || url.includes("gitlab.com");
        }
        if (selectedCategory === "figma") {
          return cat === "figma" || url.includes("figma.com");
        }
        if (selectedCategory === "deployment") {
          return cat === "deployment" || url.includes("withsummon.com") || url.includes(".app");
        }
        if (selectedCategory === "drive") {
          return cat === "drive" || url.includes("drive.google.com");
        }
        if (selectedCategory === "recording") {
          return cat === "recording" || title.endsWith(".mp4") || title.endsWith(".mov");
        }
        if (selectedCategory === "account") {
          return cat === "account" || cat === "credential";
        }
        return cat === selectedCategory;
      });
    }

    // Project filter
    if (selectedProjectId !== "all") {
      list = list.filter((r) => r.project === selectedProjectId);
    }

    // Sorting
    if (sortBy === "recently_updated") {
      list.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
    } else if (sortBy === "name_asc") {
      list.sort((a, b) => a.title.localeCompare(b.title));
    } else if (sortBy === "name_desc") {
      list.sort((a, b) => b.title.localeCompare(a.title));
    }

    return list;
  }, [resources, searchQuery, selectedCategory, selectedProjectId, sortBy]);

  // 4. Pagination
  const pageSize = 10;
  const totalItems = filteredResources.length;
  const hasFilters = Boolean(searchQuery.trim()) || selectedCategory !== "all" || selectedProjectId !== "all";
  const clearFilters = () => {
    setSearchQuery("");
    setSelectedCategory("all");
    setSelectedProjectId("all");
  };
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
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
      setActiveMenuId(null);
      await mutateResources();
    }
  };

  const handleCopyUrl = (id: string, url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    setActiveMenuId(null);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className={summonPageClassName}>
      <SummonPageHeader title="Resources" description="Project assets, links and files in one place" />

      {/* Search Bar & Controls Bar */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        {/* Large Centered Search Input */}
        <div className="relative max-w-2xl flex-1">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-tertiary" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            placeholder="Search resources by name, project, type, or keyword..."
            aria-label="Search resources"
            className={`${FIELD_CLASSNAME} h-9 w-full pr-3 pl-9`}
          />
        </div>

        {/* Action Buttons: Project Select, Filter, Add Resource */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Project Dropdown */}
          <div className="relative">
            <Select
              value={selectedProjectId}
              onValueChange={(value) => {
                setSelectedProjectId(value);
                setCurrentPage(1);
              }}
              className="w-auto min-w-40"
              options={[
                { value: "all", label: "All Projects" },
                ...projectsList.map((p) => ({ value: p.id, label: p.name })),
              ]}
            />
            <ChevronDown className="pointer-events-none absolute top-1/2 right-2.5 size-3.5 -translate-y-1/2 text-tertiary" />
          </div>

          {/* Filter Toggle Button */}
          <button
            type="button"
            onClick={() => setSelectedCategory(selectedCategory === "all" ? "document" : "all")}
            className="hover:border-accent-primary/40 flex h-9 items-center gap-1.5 rounded-xl border border-subtle bg-surface-1 px-3 text-xs font-medium text-secondary shadow-xs hover:text-primary"
          >
            <Filter className="size-3.5" />
            <span>Filter</span>
          </button>

          {/* Add Resource Button */}
          <button
            type="button"
            onClick={() => setIsAddModalOpen(true)}
            className="flex h-9 items-center gap-1.5 rounded-xl bg-accent-primary px-3.5 text-xs font-bold text-white shadow-xs transition-all hover:bg-accent-primary/90"
          >
            <Plus className="size-3.5" />
            <span>Add Resource</span>
          </button>
        </div>
      </div>

      {/* 7 Resource Categories Cards Row */}
      <CategoryCardsRow
        resources={resources}
        credentialCount={credentials.length}
        selectedCategory={selectedCategory}
        onSelectCategory={(cat) => {
          setSelectedCategory(cat);
          setCurrentPage(1);
        }}
      />

      {/* Main Content (2 Columns: Resources Table + Right Sidebar) */}
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[1fr_320px]">
        {/* Left Column: All Resources Table */}
        <div className="flex flex-col gap-4">
          <div className="rounded-2xl border border-subtle bg-surface-1 p-5 shadow-sm">
            {/* Table Header Controls */}
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-primary">All Resources</h2>
                <span className="rounded-full bg-layer-2 px-2 py-0.5 text-12 font-bold text-secondary">
                  {totalItems}
                </span>
              </div>

              <div className="flex items-center gap-3">
                {/* Sort Dropdown */}
                <div className="relative">
                  <Select
                    value={sortBy}
                    onValueChange={(value) => setSortBy(value as TResourceSortOption)}
                    className="h-8 w-auto min-w-32"
                    options={[
                      { value: "recently_updated", label: "Sort: Recently Updated" },
                      { value: "name_asc", label: "Sort: Name (A-Z)" },
                      { value: "name_desc", label: "Sort: Name (Z-A)" },
                    ]}
                  />
                  <ChevronDown className="pointer-events-none absolute top-1/2 right-2 size-3.5 -translate-y-1/2 text-tertiary" />
                </div>

                {/* View Toggle (List vs Grid) */}
                <div className="flex items-center rounded-lg border border-subtle bg-layer-1 p-0.5">
                  <button
                    type="button"
                    onClick={() => setViewMode("list")}
                    className={`flex size-7 items-center justify-center rounded-md transition-all ${
                      viewMode === "list"
                        ? "bg-surface-1 font-bold text-accent-primary shadow-xs"
                        : "text-tertiary hover:text-primary"
                    }`}
                    title="List view"
                  >
                    <List className="size-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode("grid")}
                    className={`flex size-7 items-center justify-center rounded-md transition-all ${
                      viewMode === "grid"
                        ? "bg-surface-1 font-bold text-accent-primary shadow-xs"
                        : "text-tertiary hover:text-primary"
                    }`}
                    title="Grid view"
                  >
                    <LayoutGrid className="size-4" />
                  </button>
                </div>
              </div>
            </div>

            {!isResourcesLoading && totalItems === 0 ? (
              <EmptyStateDetailed
                align="center"
                rootClassName="px-6 py-12"
                assetClassName="h-auto w-32"
                assetKey={hasFilters ? "search" : "page"}
                title={hasFilters ? "No matching resources" : "No resources yet"}
                description={
                  hasFilters
                    ? "Try another search, category or project."
                    : "Add links to documents, repositories, designs and drives so the team finds them in one place."
                }
                actions={[
                  hasFilters
                    ? { label: "Clear filters", variant: "secondary", onClick: clearFilters }
                    : { label: "Add resource", onClick: () => setIsAddModalOpen(true) },
                ]}
              />
            ) : viewMode === "list" ? (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-subtle text-12 font-medium text-tertiary">
                      <th className="pb-2.5 font-medium">Name</th>
                      <th className="pb-2.5 font-medium">Project</th>
                      <th className="pb-2.5 font-medium">Type</th>
                      <th className="pb-2.5 font-medium">Last Updated</th>
                      <th className="pb-2.5 font-medium">Updated By</th>
                      <th className="pb-2.5 text-right font-medium">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-subtle">
                    {paginatedResources.length > 0 ? (
                      paginatedResources.map((item) => {
                        const projectName =
                          item.project_detail?.name ||
                          projectsList.find((p) => p.id === item.project)?.name ||
                          "Global Resource";
                        const updatedBy =
                          item.updated_by_detail?.display_name || item.created_by_detail?.display_name || "Summon User";

                        return (
                          <tr key={item.id} className="group transition-colors hover:bg-layer-1">
                            {/* Name & Icon */}
                            <td className="py-3">
                              <a
                                href={item.url}
                                target="_blank"
                                rel="noreferrer"
                                className="flex max-w-[280px] items-center gap-2.5 truncate font-semibold text-primary hover:text-accent-primary"
                              >
                                <ResourceIcon
                                  category={item.category}
                                  title={item.title}
                                  url={item.url}
                                  className="size-4"
                                />
                                <span className="truncate">{item.title}</span>
                              </a>
                            </td>

                            {/* Project */}
                            <td className="max-w-[180px] truncate py-3 text-secondary">{projectName}</td>

                            {/* Type Pill */}
                            <td className="py-3">
                              <ResourceBadge category={item.category} />
                            </td>

                            {/* Last Updated */}
                            <td className="py-3 text-secondary">{formatRelativeTime(item.updated_at)}</td>

                            {/* Updated By */}
                            <td className="py-3">
                              <div className="flex items-center gap-2 font-medium text-primary">
                                <div className="flex size-6 items-center justify-center rounded-full bg-layer-2 text-12 font-bold text-primary">
                                  {updatedBy.charAt(0).toUpperCase()}
                                </div>
                                <span className="max-w-[120px] truncate">{updatedBy}</span>
                              </div>
                            </td>

                            {/* Actions Dropdown */}
                            <td className="relative py-3 text-right">
                              <button
                                type="button"
                                onClick={() => setActiveMenuId(activeMenuId === item.id ? null : item.id)}
                                className="rounded-lg p-1 text-secondary hover:bg-layer-2 hover:text-primary"
                              >
                                <MoreHorizontal className="size-4" />
                              </button>

                              {activeMenuId === item.id && (
                                <div className="absolute top-full right-0 z-30 mt-1 w-36 rounded-xl border border-subtle bg-surface-1 p-1 text-left shadow-xl">
                                  <a
                                    href={item.url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-secondary hover:bg-layer-1 hover:text-primary"
                                    onClick={() => setActiveMenuId(null)}
                                  >
                                    <ExternalLink className="size-3.5" />
                                    Open Link
                                  </a>
                                  <button
                                    type="button"
                                    onClick={() => handleCopyUrl(item.id, item.url)}
                                    className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-secondary hover:bg-layer-1 hover:text-primary"
                                  >
                                    {copiedId === item.id ? (
                                      <Check className="text-emerald-500 size-3.5" />
                                    ) : (
                                      <Copy className="size-3.5" />
                                    )}
                                    Copy URL
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteResource(item.id)}
                                    className="text-red-600 hover:bg-red-500/10 dark:text-red-400 flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs"
                                  >
                                    <Trash2 className="size-3.5" />
                                    Delete
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-xs text-tertiary">
                          Loading resources…
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            ) : (
              /* Grid View */
              <div className="mt-4 grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
                {paginatedResources.map((item) => {
                  const projectName =
                    item.project_detail?.name ||
                    projectsList.find((p) => p.id === item.project)?.name ||
                    "Global Resource";

                  return (
                    <a
                      key={item.id}
                      href={item.url}
                      target="_blank"
                      rel="noreferrer"
                      className="group hover:border-accent-primary/40 flex flex-col justify-between rounded-xl border border-subtle bg-layer-1 p-4 transition-all hover:bg-layer-2 hover:shadow-xs"
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <ResourceIcon
                            category={item.category}
                            title={item.title}
                            url={item.url}
                            className="size-4.5"
                          />
                          <ResourceBadge category={item.category} />
                        </div>

                        <h3 className="mt-3 line-clamp-2 text-xs font-bold text-primary group-hover:text-accent-primary">
                          {item.title}
                        </h3>
                        <p className="mt-1 line-clamp-1 text-12 text-tertiary">{projectName}</p>
                      </div>

                      <div className="mt-4 flex items-center justify-between border-t border-subtle pt-2.5 text-12 text-tertiary">
                        <span>{formatRelativeTime(item.updated_at)}</span>
                        <ExternalLink className="size-3 text-secondary group-hover:text-accent-primary" />
                      </div>
                    </a>
                  );
                })}
              </div>
            )}

            {/* Pagination Footer */}
            <div
              hidden={totalItems === 0}
              className="mt-5 flex flex-col items-center justify-between gap-3 border-t border-subtle pt-4 text-xs text-secondary sm:flex-row"
            >
              <div>
                Showing {totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1} to{" "}
                {Math.min(currentPage * pageSize, totalItems)} of {totalItems} resources
              </div>

              {totalPages > 1 && (
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    className="flex size-7 items-center justify-center rounded-lg border border-subtle text-secondary hover:bg-layer-1 disabled:opacity-40"
                  >
                    ‹
                  </button>

                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    const pageNum = i + 1;
                    const isActive = currentPage === pageNum;
                    return (
                      <button
                        key={pageNum}
                        type="button"
                        onClick={() => setCurrentPage(pageNum)}
                        className={`flex size-7 items-center justify-center rounded-lg text-xs font-bold transition-all ${
                          isActive
                            ? "bg-accent-primary text-white shadow-xs"
                            : "border border-subtle bg-surface-1 text-secondary hover:bg-layer-1 hover:text-primary"
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}

                  {totalPages > 5 && (
                    <>
                      <span className="px-1 text-tertiary">...</span>
                      <button
                        type="button"
                        onClick={() => setCurrentPage(totalPages)}
                        className={`flex size-7 items-center justify-center rounded-lg border border-subtle bg-surface-1 text-xs font-bold text-secondary hover:bg-layer-1 hover:text-primary`}
                      >
                        {totalPages}
                      </button>
                    </>
                  )}

                  <button
                    type="button"
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    className="flex size-7 items-center justify-center rounded-lg border border-subtle text-secondary hover:bg-layer-1 disabled:opacity-40"
                  >
                    ›
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: sidebar widgets */}
        <div className="flex flex-col gap-6">
          {/* Recent Files */}
          <RecentFilesCard
            resources={resources}
            onSelectCategory={(cat) => {
              setSelectedCategory(cat);
              setCurrentPage(1);
            }}
          />

          {/* Credentials */}
          <CredentialsSidebarCard credentials={credentials} workspaceSlug={workspaceSlug} />
        </div>
      </div>

      {/* Add Resource Modal */}
      <AddResourceModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSave={handleSaveResource}
        projects={projectsList}
      />
    </div>
  );
}
