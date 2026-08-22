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
  Bell,
  Calendar as CalendarIcon,
  Settings as SettingsIcon,
  Plus,
  ExternalLink,
  Trash2,
  Copy,
  Check,
} from "lucide-react";
import type { ISummonResourceLink } from "@plane/types";
import { useProject } from "@/hooks/store/use-project";
import { summonService } from "@/services/summon.service";
import { CategoryCardsRow } from "./category-cards-row";
import { QuickAccessCard } from "./quick-access-card";
import { RecentFilesCard } from "./recent-files-card";
import { CredentialsSidebarCard } from "./credentials-sidebar-card";
import { ResourceIcon } from "./resource-icon";
import { ResourceBadge } from "./resource-badge";
import { AddResourceModal } from "./add-resource-modal";
import type { TResourceViewMode, TResourceSortOption, ICreateResourcePayload } from "./types";

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
    error: resourcesError,
    isLoading: isResourcesLoading,
    mutate: mutateResources,
  } = useSWR(["summon-resources", workspaceSlug], () => summonService.listResources(workspaceSlug));

  const { data: credentials = [], mutate: mutateCredentials } = useSWR(["summon-credentials", workspaceSlug], () =>
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
    <div className="flex flex-col gap-6 p-6 lg:p-8">
      {/* Top Header */}
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-primary">Resources</h1>
          <p className="text-xs font-medium text-secondary">All project assets, links and resources in one place</p>
        </div>

        {/* Top Right Utility Icons */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="shadow-xs relative flex size-8.5 items-center justify-center rounded-xl border border-subtle bg-surface-1 text-secondary hover:bg-layer-1 hover:text-primary"
            title="Notifications"
          >
            <Bell className="size-4" />
            <span className="bg-red-500 ring-surface-1 absolute top-1.5 right-1.5 size-2 rounded-full ring-2" />
          </button>
          <button
            type="button"
            className="shadow-xs flex size-8.5 items-center justify-center rounded-xl border border-subtle bg-surface-1 text-secondary hover:bg-layer-1 hover:text-primary"
            title="Schedule"
          >
            <CalendarIcon className="size-4" />
          </button>
          <button
            type="button"
            className="shadow-xs flex size-8.5 items-center justify-center rounded-xl border border-subtle bg-surface-1 text-secondary hover:bg-layer-1 hover:text-primary"
            title="Settings"
          >
            <SettingsIcon className="size-4" />
          </button>
        </div>
      </div>

      {/* Search Bar & Controls Bar */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        {/* Large Centered Search Input */}
        <div className="relative max-w-2xl flex-1">
          <Search className="absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-tertiary" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            placeholder="Search resources by name, project, type, or keyword..."
            className="text-xs placeholder-tertiary shadow-xs focus:border-accent-primary focus:ring-accent-primary w-full rounded-2xl border border-subtle bg-surface-1 py-2.5 pr-12 pl-10 text-primary focus:ring-1 focus:outline-none"
          />
          <div className="absolute top-1/2 right-3 -translate-y-1/2 rounded-md border border-subtle bg-layer-1 px-1.5 py-0.5 text-[10px] font-semibold text-tertiary">
            ⌘ K
          </div>
        </div>

        {/* Action Buttons: Project Select, Filter, Add Resource */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Project Dropdown */}
          <div className="relative">
            <select
              value={selectedProjectId}
              onChange={(e) => {
                setSelectedProjectId(e.target.value);
                setCurrentPage(1);
              }}
              className="text-xs shadow-xs focus:border-accent-primary h-9 cursor-pointer appearance-none rounded-xl border border-subtle bg-surface-1 pr-8 pl-3 font-medium text-primary focus:outline-none"
            >
              <option value="all">All Projects</option>
              {projectsList.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute top-1/2 right-2.5 size-3.5 -translate-y-1/2 text-tertiary" />
          </div>

          {/* Filter Toggle Button */}
          <button
            type="button"
            onClick={() => setSelectedCategory(selectedCategory === "all" ? "document" : "all")}
            className="text-xs shadow-xs hover:border-accent-primary/40 flex h-9 items-center gap-1.5 rounded-xl border border-subtle bg-surface-1 px-3 font-medium text-secondary hover:text-primary"
          >
            <Filter className="size-3.5" />
            <span>Filter</span>
          </button>

          {/* Add Resource Button */}
          <button
            type="button"
            onClick={() => setIsAddModalOpen(true)}
            className="text-xs shadow-xs flex h-9 items-center gap-1.5 rounded-xl bg-accent-primary px-3.5 font-bold text-white transition-all hover:bg-accent-primary/90"
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
          <div className="shadow-sm rounded-2xl border border-subtle bg-surface-1 p-5">
            {/* Table Header Controls */}
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-primary">All Resources</h2>
                <span className="rounded-full bg-layer-2 px-2 py-0.5 text-[11px] font-bold text-secondary">
                  {totalItems}
                </span>
              </div>

              <div className="flex items-center gap-3">
                {/* Sort Dropdown */}
                <div className="relative">
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as TResourceSortOption)}
                    className="text-xs h-8 cursor-pointer appearance-none rounded-lg border border-subtle bg-layer-1 pr-7 pl-2.5 font-medium text-secondary hover:text-primary focus:outline-none"
                  >
                    <option value="recently_updated">Sort: Recently Updated</option>
                    <option value="name_asc">Sort: Name (A-Z)</option>
                    <option value="name_desc">Sort: Name (Z-A)</option>
                  </select>
                  <ChevronDown className="pointer-events-none absolute top-1/2 right-2 size-3.5 -translate-y-1/2 text-tertiary" />
                </div>

                {/* View Toggle (List vs Grid) */}
                <div className="flex items-center rounded-lg border border-subtle bg-layer-1 p-0.5">
                  <button
                    type="button"
                    onClick={() => setViewMode("list")}
                    className={`flex size-7 items-center justify-center rounded-md transition-all ${
                      viewMode === "list"
                        ? "shadow-xs bg-surface-1 font-bold text-accent-primary"
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
                        ? "shadow-xs bg-surface-1 font-bold text-accent-primary"
                        : "text-tertiary hover:text-primary"
                    }`}
                    title="Grid view"
                  >
                    <LayoutGrid className="size-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* List / Table View */}
            {viewMode === "list" ? (
              <div className="mt-4 overflow-x-auto">
                <table className="text-xs w-full text-left">
                  <thead>
                    <tr className="border-b border-subtle text-[11px] font-semibold text-tertiary uppercase">
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
                                <div className="flex size-6 items-center justify-center rounded-full bg-layer-2 text-[10px] font-bold text-primary">
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
                                <div className="shadow-xl absolute top-full right-0 z-30 mt-1 w-36 rounded-xl border border-subtle bg-surface-1 p-1 text-left">
                                  <a
                                    href={item.url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-xs flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-secondary hover:bg-layer-1 hover:text-primary"
                                    onClick={() => setActiveMenuId(null)}
                                  >
                                    <ExternalLink className="size-3.5" />
                                    Open Link
                                  </a>
                                  <button
                                    type="button"
                                    onClick={() => handleCopyUrl(item.id, item.url)}
                                    className="text-xs flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-secondary hover:bg-layer-1 hover:text-primary"
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
                                    className="text-xs text-red-600 hover:bg-red-500/10 dark:text-red-400 flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5"
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
                        <td colSpan={6} className="text-xs py-8 text-center text-tertiary">
                          {isResourcesLoading ? (
                            "Loading resources from database..."
                          ) : (
                            <div className="space-y-2">
                              <div>No resources found matching the current filters.</div>
                              <button
                                type="button"
                                onClick={() => setIsAddModalOpen(true)}
                                className="font-semibold text-accent-primary hover:underline"
                              >
                                + Add the first resource link
                              </button>
                            </div>
                          )}
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
                      className="group hover:border-accent-primary/40 hover:shadow-xs flex flex-col justify-between rounded-xl border border-subtle bg-layer-1 p-4 transition-all hover:bg-layer-2"
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

                        <h3 className="text-xs mt-3 line-clamp-2 font-bold text-primary group-hover:text-accent-primary">
                          {item.title}
                        </h3>
                        <p className="mt-1 line-clamp-1 text-[11px] text-tertiary">{projectName}</p>
                      </div>

                      <div className="mt-4 flex items-center justify-between border-t border-subtle pt-2.5 text-[10px] text-tertiary">
                        <span>{formatRelativeTime(item.updated_at)}</span>
                        <ExternalLink className="size-3 text-secondary group-hover:text-accent-primary" />
                      </div>
                    </a>
                  );
                })}
              </div>
            )}

            {/* Pagination Footer */}
            <div className="text-xs mt-5 flex flex-col items-center justify-between gap-3 border-t border-subtle pt-4 text-secondary sm:flex-row">
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
                        className={`text-xs flex size-7 items-center justify-center rounded-lg font-bold transition-all ${
                          isActive
                            ? "shadow-xs bg-accent-primary text-white"
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
                        className={`text-xs flex size-7 items-center justify-center rounded-lg border border-subtle bg-surface-1 font-bold text-secondary hover:bg-layer-1 hover:text-primary`}
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

        {/* Right Column: 3 Sidebar Widgets */}
        <div className="flex flex-col gap-6">
          {/* 1. Quick Access */}
          <QuickAccessCard
            workspaceSlug={workspaceSlug}
            onSelectCategory={(cat) => {
              setSelectedCategory(cat);
              setCurrentPage(1);
            }}
          />

          {/* 2. Recent Files */}
          <RecentFilesCard
            resources={resources}
            onSelectCategory={(cat) => {
              setSelectedCategory(cat);
              setCurrentPage(1);
            }}
          />

          {/* 3. Credentials */}
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
