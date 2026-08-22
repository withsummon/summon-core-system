/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import React, { useState, useMemo } from "react";
import useSWR from "swr";
import Link from "next/link";
import { Search, FileText, FolderGit2, ExternalLink, Sparkles, Plus, LayoutGrid, List, Clock } from "lucide-react";
import { listAccessiblePlanePages } from "@/services/summon-plane.service";
import { useProject } from "@/hooks/store/use-project";
import { SummonRequestState } from "@/components/summon/request-state";

interface IDocumentsRootProps {
  workspaceSlug: string;
}

export function DocumentsRoot({ workspaceSlug }: IDocumentsRootProps) {
  const { joinedProjectIds, getProjectById } = useProject();

  const {
    data: pages = [],
    error,
    isLoading,
    mutate,
  } = useSWR(["summon-plane-pages", workspaceSlug], () => listAccessiblePlanePages(workspaceSlug));

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState("all");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  const projectsList = useMemo(
    () => joinedProjectIds.map((id) => ({ id, name: getProjectById(id)?.name || id })),
    [joinedProjectIds, getProjectById]
  );

  const filteredPages = useMemo(() => {
    let list = [...pages];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (item) =>
          (item.page.name || "").toLowerCase().includes(q) ||
          item.project.name.toLowerCase().includes(q) ||
          item.project.identifier.toLowerCase().includes(q)
      );
    }

    if (selectedProjectId !== "all") {
      list = list.filter((item) => item.project.id === selectedProjectId);
    }

    return list;
  }, [pages, searchQuery, selectedProjectId]);

  return (
    <div className="flex flex-col gap-6 p-6 lg:p-8">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-primary">Documents & Knowledge Base</h1>
          <p className="text-xs font-medium text-secondary">
            Indexed Plane Pages, collaborative project specifications, and enterprise documentation
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Link
            href={`/${workspaceSlug}/summon/automation/`}
            className="text-xs shadow-xs hover:border-accent-primary/40 flex items-center gap-1.5 rounded-xl border border-subtle bg-surface-1 px-3.5 py-2 font-bold text-primary hover:bg-layer-1"
          >
            <Sparkles className="size-3.5 text-accent-primary" />
            <span>AI Document Generator</span>
          </Link>
          <Link
            href={`/${workspaceSlug}/summon/reports/`}
            className="text-xs shadow-xs flex items-center gap-1.5 rounded-xl bg-accent-primary px-3.5 py-2 font-bold text-white hover:bg-accent-primary/90"
          >
            <Plus className="size-3.5" />
            <span>Generate Deliverable</span>
          </Link>
        </div>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3">
        <div className="shadow-sm flex flex-col justify-between rounded-2xl border border-subtle bg-surface-1 p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-secondary">Total Pages</span>
            <div className="bg-blue-500/10 text-blue-600 flex size-8 items-center justify-center rounded-xl">
              <FileText className="size-4.5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold tracking-tight text-primary">{pages.length}</div>
            <div className="mt-1 text-[11px] font-medium text-tertiary">Indexed across workspaces</div>
          </div>
        </div>

        <div className="shadow-sm flex flex-col justify-between rounded-2xl border border-subtle bg-surface-1 p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-secondary">Connected Projects</span>
            <div className="bg-indigo-500/10 text-indigo-600 flex size-8 items-center justify-center rounded-xl">
              <FolderGit2 className="size-4.5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold tracking-tight text-primary">
              {new Set(pages.map((p) => p.project.id)).size}
            </div>
            <div className="mt-1 text-[11px] font-medium text-tertiary">Workspaces with documents</div>
          </div>
        </div>

        <div className="shadow-sm col-span-2 flex flex-col justify-between rounded-2xl border border-subtle bg-surface-1 p-4 sm:col-span-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-secondary">Editor Integration</span>
            <div className="bg-emerald-500/10 text-emerald-600 flex size-8 items-center justify-center rounded-xl">
              <Sparkles className="size-4.5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl text-emerald-600 dark:text-emerald-400 font-bold tracking-tight">Native Plane</div>
            <div className="mt-1 text-[11px] font-medium text-tertiary">Real-time collaborative pages</div>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-md flex-1">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-tertiary" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search documents by name or project..."
            className="text-xs placeholder-tertiary shadow-xs focus:border-accent-primary w-full rounded-xl border border-subtle bg-surface-1 py-2 pr-4 pl-9 text-primary focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-2.5">
          <select
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
            className="text-xs shadow-xs focus:border-accent-primary h-9 cursor-pointer rounded-xl border border-subtle bg-surface-1 px-3 font-medium text-primary focus:outline-none"
          >
            <option value="all">All Projects</option>
            {projectsList.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>

          <div className="shadow-xs flex items-center rounded-xl border border-subtle bg-surface-1 p-0.5">
            <button
              type="button"
              onClick={() => setViewMode("grid")}
              className={`flex size-8 items-center justify-center rounded-lg transition-all ${
                viewMode === "grid" ? "bg-layer-2 font-bold text-accent-primary" : "text-tertiary hover:text-primary"
              }`}
              title="Grid View"
            >
              <LayoutGrid className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode("list")}
              className={`flex size-8 items-center justify-center rounded-lg transition-all ${
                viewMode === "list" ? "bg-layer-2 font-bold text-accent-primary" : "text-tertiary hover:text-primary"
              }`}
              title="List View"
            >
              <List className="size-4" />
            </button>
          </div>
        </div>
      </div>

      <SummonRequestState
        loading={isLoading}
        error={error}
        empty={!isLoading && filteredPages.length === 0}
        emptyMessage="No documents found matching the search criteria."
        onRetry={() => void mutate()}
      />

      {/* Documents Grid / List */}
      {viewMode === "grid" ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredPages.map(({ page, project }) => (
            <Link
              key={page.id}
              href={`/${workspaceSlug}/projects/${project.id}/pages/${page.id}/`}
              className="group shadow-sm hover:border-accent-primary/40 hover:shadow-md flex flex-col justify-between rounded-2xl border border-subtle bg-surface-1 p-5 transition-all"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div className="bg-blue-500/10 text-blue-600 flex size-9 items-center justify-center rounded-xl">
                    <FileText className="size-4.5" />
                  </div>
                  <span className="rounded-md bg-layer-2 px-2 py-0.5 text-[10px] font-bold text-secondary">
                    {project.identifier}
                  </span>
                </div>

                <h3 className="text-sm mt-3.5 line-clamp-2 font-bold text-primary group-hover:text-accent-primary">
                  {page.name || "Untitled Document"}
                </h3>
                <p className="text-xs mt-1 truncate text-tertiary">{project.name}</p>
              </div>

              <div className="mt-5 flex items-center justify-between border-t border-subtle pt-3 text-[11px] font-semibold text-accent-primary">
                <span>Open in Plane Editor</span>
                <ExternalLink className="size-3.5 transition-transform group-hover:translate-x-0.5" />
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="shadow-sm overflow-hidden rounded-2xl border border-subtle bg-surface-1">
          <table className="text-xs w-full text-left">
            <thead>
              <tr className="border-b border-subtle bg-layer-1 text-[11px] font-semibold text-tertiary uppercase">
                <th className="px-5 py-3.5">Document Title</th>
                <th className="px-5 py-3.5">Project</th>
                <th className="px-5 py-3.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-subtle">
              {filteredPages.map(({ page, project }) => (
                <tr key={page.id} className="group transition-colors hover:bg-layer-1">
                  <td className="px-5 py-3.5 font-semibold text-primary">
                    <Link
                      href={`/${workspaceSlug}/projects/${project.id}/pages/${page.id}/`}
                      className="hover:text-accent-primary"
                    >
                      {page.name || "Untitled Document"}
                    </Link>
                  </td>
                  <td className="px-5 py-3.5 text-secondary">{project.name}</td>
                  <td className="px-5 py-3.5 text-right">
                    <Link
                      href={`/${workspaceSlug}/projects/${project.id}/pages/${page.id}/`}
                      className="inline-flex items-center gap-1 font-semibold text-accent-primary hover:underline"
                    >
                      Open Editor <ExternalLink className="size-3" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
