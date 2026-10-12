/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import React, { useState, useMemo } from "react";
import useSWR from "swr";
import Link from "next/link";
import { Search, FileText, ExternalLink, Sparkles, Plus, LayoutGrid, List } from "lucide-react";
import { listAccessiblePlanePages } from "@/services/summon-plane.service";
import { useProject } from "@/hooks/store/use-project";
import { SummonRequestState } from "@/components/summon/request-state";
import { getButtonStyling } from "@plane/propel/button";
import { FIELD_CLASSNAME } from "@plane/propel/input";
import { Select } from "@plane/propel/select";
import { SummonMetric, SummonMetricStrip, SummonPageHeader, summonPageClassName } from "@/components/summon/screen";

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
    <div className={summonPageClassName}>
      <SummonPageHeader
        title="Documents"
        description="Project pages, specifications and shared documentation"
        actions={
          <>
            <Link href={`/${workspaceSlug}/summon/automation/`} className={getButtonStyling("secondary", "lg")}>
              <Sparkles className="text-accent-primary" />
              Generate document
            </Link>
            <Link href={`/${workspaceSlug}/summon/reports/`} className={getButtonStyling("primary", "lg")}>
              <Plus />
              New deliverable
            </Link>
          </>
        }
      />

      <SummonMetricStrip>
        <SummonMetric label="Pages" value={pages.length} />
        <SummonMetric label="Projects with pages" value={new Set(pages.map((p) => p.project.id)).size} />
      </SummonMetricStrip>

      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-md flex-1">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-tertiary" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search documents by name or project..."
            aria-label="Search documents"
            className={`${FIELD_CLASSNAME} h-9 w-full pr-3 pl-9`}
          />
        </div>

        <div className="flex items-center gap-2.5">
          <Select
            value={selectedProjectId}
            onValueChange={(value) => setSelectedProjectId(value)}
            className="w-auto min-w-40"
            options={[
              { value: "all", label: "All Projects" },
              ...projectsList.map((p) => ({ value: p.id, label: p.name })),
            ]}
          />

          <div className="flex items-center rounded-xl border border-subtle bg-surface-1 p-0.5 shadow-xs">
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
        emptyAsset={pages.length ? "search" : "page"}
        emptyTitle={pages.length ? "No matching documents" : "No documents yet"}
        emptyMessage={
          pages.length ? "Try another search or project." : "Pages you create in your projects show up here."
        }
        onRetry={() => void mutate()}
      />

      {/* Documents Grid / List */}
      {viewMode === "grid" ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredPages.map(({ page, project }) => (
            <Link
              key={page.id}
              href={`/${workspaceSlug}/projects/${project.id}/pages/${page.id}/`}
              className="group hover:border-accent-primary/40 flex flex-col justify-between rounded-2xl border border-subtle bg-surface-1 p-5 shadow-sm transition-all hover:shadow-md"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div className="bg-blue-500/10 text-blue-600 flex size-9 items-center justify-center rounded-xl">
                    <FileText className="size-4.5" />
                  </div>
                  <span className="rounded-md bg-layer-2 px-2 py-0.5 text-12 font-bold text-secondary">
                    {project.identifier}
                  </span>
                </div>

                <h3 className="mt-3.5 line-clamp-2 text-sm font-bold text-primary group-hover:text-accent-primary">
                  {page.name || "Untitled Document"}
                </h3>
                <p className="mt-1 truncate text-xs text-tertiary">{project.name}</p>
              </div>

              <div className="mt-5 flex items-center justify-between border-t border-subtle pt-3 text-12 font-semibold text-accent-primary">
                <span>Open in editor</span>
                <ExternalLink className="size-3.5 transition-transform group-hover:translate-x-0.5" />
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-subtle bg-surface-1 shadow-sm">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-subtle bg-layer-1 text-12 font-medium text-tertiary">
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
