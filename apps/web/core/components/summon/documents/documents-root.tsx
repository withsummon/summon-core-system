/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import React, { useState, useEffect } from "react";
import { useOutletContext, useSearchParams } from "react-router";
import { useQuery } from "convex/react";
import { usePaginatedQuery } from "convex-helpers/react";
import { api } from "@summon/convex/api";
import { type WorkspaceSession } from "@/components/workspace/native-shell/session";
import { DocumentDetail } from "@/components/convex-core/documents/documents";
import { DocumentAccessBoundary } from "@/components/convex-core/documents/editor";
import Link from "next/link";
import { Search, FileText, FolderGit2, ExternalLink, Sparkles, Plus, LayoutGrid, List } from "lucide-react";
import { SummonRequestState } from "@/components/summon/request-state";
import { Select } from "@plane/propel/select";

interface IDocumentsRootProps {
  workspaceSlug: string;
}

export function DocumentsRoot({ workspaceSlug }: IDocumentsRootProps) {
  const { workspace } = useOutletContext<WorkspaceSession>();
  const projectsList = useQuery(api.projects.index.list, { workspaceId: workspace._id }) ?? [];
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState("all");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [params, setParams] = useSearchParams();
  const selected = params.get("document");
  const selectedProject = projectsList.find((row) => row._id === selectedProjectId);
  const projectUnavailable = selectedProjectId !== "all" && !selectedProject;
  const {
    results: filteredPages,
    status,
    loadMore,
  } = usePaginatedQuery(
    api.documents.index.list,
    projectUnavailable
      ? "skip"
      : {
          workspaceId: workspace._id,
          search: searchQuery,
          contextualSearch: true,
          projectId: selectedProject?._id,
          sortKey: "updated_at",
          sortBy: "desc",
        },
    { initialNumItems: 100 }
  );
  const summary = usePaginatedQuery(
    api.documents.index.list,
    { workspaceId: workspace._id, sortKey: "updated_at", sortBy: "desc" },
    { initialNumItems: 100 }
  );
  const { status: summaryStatus, loadMore: loadSummary } = summary;
  useEffect(() => {
    if (summaryStatus === "CanLoadMore") loadSummary(100);
  }, [summaryStatus, loadSummary]);
  const pages = summary.results;
  const isLoading = status === "LoadingFirstPage";
  if (selected)
    return (
      <DocumentAccessBoundary
        key={selected}
        documentId={selected}
        onBack={() => setParams({})}
        unavailableTitle="This document is unavailable"
        backLabel="Back to documents"
      >
        {(onCapture, isSaving, recovery) => (
          <DocumentDetail
            workspaceId={workspace._id}
            documentId={selected}
            workspaceSlug={workspaceSlug}
            workspaceRole={workspace.membershipRole}
            onBack={() => setParams({})}
            onCapture={onCapture}
            isSaving={isSaving}
            recovery={recovery(false)}
          />
        )}
      </DocumentAccessBoundary>
    );
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
            <div className="text-2xl font-bold tracking-tight text-primary">
              {summary.status === "Exhausted" ? pages.length : "…"}
            </div>
            <div className="mt-1 text-[11px] font-medium text-tertiary">Across accessible projects</div>
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
              {summary.status === "Exhausted"
                ? new Set(pages.flatMap((p) => p.projects.map((project) => project.id))).size
                : "…"}
            </div>
            <div className="mt-1 text-[11px] font-medium text-tertiary">Projects with documents</div>
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
            maxLength={255}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label="Search documents"
            placeholder="Search documents by name or project..."
            className="text-xs placeholder-tertiary shadow-xs focus:border-accent-primary w-full rounded-xl border border-subtle bg-surface-1 py-2 pr-4 pl-9 text-primary focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-2.5">
          <Select
            value={selectedProjectId}
            onValueChange={(value) => setSelectedProjectId(value)}
            className="w-auto min-w-40"
            options={[
              { value: "all", label: "All Projects" },
              ...projectsList.map((p) => ({ value: p._id, label: p.name })),
            ]}
          />

          <div className="shadow-xs flex items-center rounded-xl border border-subtle bg-surface-1 p-0.5">
            <button
              type="button"
              onClick={() => setViewMode("grid")}
              className={`flex size-8 items-center justify-center rounded-lg transition-all ${
                viewMode === "grid" ? "bg-layer-2 font-bold text-accent-primary" : "text-tertiary hover:text-primary"
              }`}
              aria-label="Grid View"
              aria-pressed={viewMode === "grid"}
            >
              <LayoutGrid className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode("list")}
              className={`flex size-8 items-center justify-center rounded-lg transition-all ${
                viewMode === "list" ? "bg-layer-2 font-bold text-accent-primary" : "text-tertiary hover:text-primary"
              }`}
              aria-label="List View"
              aria-pressed={viewMode === "list"}
            >
              <List className="size-4" />
            </button>
          </div>
        </div>
      </div>

      {projectUnavailable && (
        <div role="alert" className="text-xs flex items-center gap-3 rounded-xl border border-subtle p-4">
          <p>This project is unavailable. Choose another project.</p>
          <button type="button" onClick={() => setSelectedProjectId("all")}>
            Clear project filter
          </button>
        </div>
      )}
      <SummonRequestState
        loading={isLoading}
        empty={!projectUnavailable && status === "Exhausted" && filteredPages.length === 0}
        emptyMessage="No documents found matching the search criteria."
      />

      {status === "CanLoadMore" && (
        <button
          type="button"
          className="text-xs rounded-xl border border-subtle px-4 py-2"
          onClick={() => loadMore(100)}
        >
          Load more documents
        </button>
      )}
      {status === "LoadingMore" && <p role="status">Loading more documents…</p>}
      {/* Documents Grid / List */}
      {viewMode === "grid" ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredPages.map(({ document, projects }) => (
            <Link
              key={document._id}
              href={`/${workspaceSlug}/summon/documents/?document=${document._id}`}
              className="group shadow-sm hover:border-accent-primary/40 hover:shadow-md flex flex-col justify-between rounded-2xl border border-subtle bg-surface-1 p-5 transition-all"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div className="bg-blue-500/10 text-blue-600 flex size-9 items-center justify-center rounded-xl">
                    <FileText className="size-4.5" />
                  </div>
                  <span className="rounded-md bg-layer-2 px-2 py-0.5 text-[10px] font-bold text-secondary">
                    {projects.map((project) => project.identifier).join(", ") || "Workspace"}
                  </span>
                </div>

                <h3 className="text-sm mt-3.5 line-clamp-2 font-bold text-primary group-hover:text-accent-primary">
                  {document.name || "Untitled Document"}
                </h3>
                <p className="text-xs mt-1 truncate text-tertiary">
                  {projects.map((project) => project.name).join(", ") || "Workspace"}
                </p>
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
              {filteredPages.map(({ document, projects }) => (
                <tr key={document._id} className="group transition-colors hover:bg-layer-1">
                  <td className="px-5 py-3.5 font-semibold text-primary">
                    <Link
                      href={`/${workspaceSlug}/summon/documents/?document=${document._id}`}
                      className="hover:text-accent-primary"
                    >
                      {document.name || "Untitled Document"}
                    </Link>
                  </td>
                  <td className="px-5 py-3.5 text-secondary">
                    {projects.map((project) => project.name).join(", ") || "Workspace"}
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <Link
                      href={`/${workspaceSlug}/summon/documents/?document=${document._id}`}
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
