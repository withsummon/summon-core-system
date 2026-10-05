/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */
import { useState } from "react";
import { Filter, Eye, Search, Download, Trash2 } from "lucide-react";
import type { FunctionArgs, FunctionReturnType } from "convex/server";
import type { Doc } from "@summon/convex/data-model";
import type { api } from "@summon/convex/api";
import { Button } from "@plane/propel/button";
import { CustomMenu } from "@plane/ui";
import { TypeIcon, getDocumentTypeTheme } from "./type-icon";
export function GeneratedDocumentsTable({
  documents,
  templates,
  projectName,
  criteria,
  onCriteriaChange,
  onPreviewDocument,
  onDeleteDocument,
  options,
  busy,
  canDelete,
  loading,
  exhausted,
  onLoadMore,
}: {
  documents: Doc<"automationJobs">[];
  templates: Doc<"automationTemplates">[];
  projectName: string;
  criteria: Pick<FunctionArgs<typeof api.automation.jobs.list>, "type" | "status" | "search">;
  onCriteriaChange: (
    criteria: Pick<FunctionArgs<typeof api.automation.jobs.list>, "type" | "status" | "search">
  ) => void;
  onPreviewDocument: (job: Doc<"automationJobs">) => void;
  onDeleteDocument: (job: Doc<"automationJobs">) => void;
  options: FunctionReturnType<typeof api.automation.templates.options>;
  busy: boolean;
  canDelete: boolean;
  loading: boolean;
  exhausted: boolean;
  onLoadMore?: () => void;
}) {
  const [filterOpen, setFilterOpen] = useState(false);
  const types = Array.from(new Set(templates.map((template) => template.type)));
  return (
    <div
      id="automation-documents"
      className="shadow-xs flex h-full flex-col rounded-xl border border-subtle bg-surface-1 p-5"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-primary">Generated Documents</h2>
        <button
          type="button"
          disabled={busy}
          onClick={() => setFilterOpen(!filterOpen)}
          className="text-xs flex items-center gap-1.5 rounded-lg border border-subtle px-3 py-1.5 font-medium text-secondary"
        >
          <Filter size={13} />
          Filters
        </button>
      </div>
      {filterOpen && (
        <fieldset
          disabled={busy}
          className="mt-3 flex flex-wrap items-center gap-3 rounded-lg border border-subtle bg-surface-2/60 p-2.5"
        >
          <label className="relative min-w-[160px] flex-1">
            <Search aria-hidden size={13} className="absolute top-1/2 left-2.5 -translate-y-1/2" />
            <input
              aria-label="Search generated documents"
              type="search"
              maxLength={255}
              placeholder="Search title, template, or input…"
              value={criteria.search ?? ""}
              onChange={(event) => onCriteriaChange({ ...criteria, search: event.target.value })}
              className="text-xs w-full rounded-md border border-subtle bg-surface-1 py-1.5 pr-3 pl-8"
            />
          </label>
          <label className="text-xs flex items-center gap-2">
            Status:
            <select
              value={criteria.status ?? ""}
              onChange={(event) => {
                const status =
                  event.target.value === "published"
                    ? "published"
                    : options.statuses.find((value) => value === event.target.value);
                onCriteriaChange({ ...criteria, status });
              }}
              className="rounded-md border border-subtle bg-surface-1 px-2 py-1.5"
            >
              <option value="">All Statuses</option>
              {options.statuses.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
              <option value="published">Published</option>
            </select>
          </label>
        </fieldset>
      )}
      <nav
        aria-label="Document template types"
        className="hide-horizontal-scrollbar mt-3 flex gap-4 overflow-x-auto border-b border-subtle"
      >
        <button
          type="button"
          disabled={busy}
          onClick={() => onCriteriaChange({ ...criteria, type: undefined })}
          className={`text-xs pb-2.5 whitespace-nowrap ${!criteria.type ? "border-blue-600 border-b-2 font-semibold text-accent-primary" : "text-secondary"}`}
        >
          All
        </button>
        {types.map((type) => (
          <button
            type="button"
            key={type}
            disabled={busy}
            onClick={() => onCriteriaChange({ ...criteria, type })}
            className={`text-xs pb-2.5 whitespace-nowrap ${criteria.type === type ? "border-blue-600 border-b-2 font-semibold text-accent-primary" : "text-secondary"}`}
          >
            {templates.find((template) => template.type === type)?.name}
          </button>
        ))}
      </nav>
      <div className="mt-3 flex-1 overflow-x-auto">
        <table className="w-full min-w-[700px] border-collapse text-left">
          <thead>
            <tr className="border-b border-subtle text-[11px] font-semibold text-secondary">
              {["Document", "Type", "Context", "Created By", "Created At", "Status", "Actions"].map((label) => (
                <th key={label} className="pr-3 pb-2.5 font-medium">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="text-xs divide-y divide-subtle">
            {documents.map((job) => (
              <tr key={job._id} className="group hover:bg-surface-2/60">
                <td className="py-3 pr-3">
                  <div className="flex items-start gap-2.5">
                    <TypeIcon type={job.template.type} size={16} />
                    <div className="max-w-[240px]">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => onPreviewDocument(job)}
                        className="truncate text-left font-semibold text-primary"
                      >
                        {job.title}
                      </button>
                      <p className="mt-0.5 truncate text-[11px] text-secondary">{job.template.description}</p>
                    </div>
                  </div>
                </td>
                <td className="py-3 pr-3 whitespace-nowrap">
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[10px] font-medium ${getDocumentTypeTheme(job.template.type).badgeBg}`}
                  >
                    {job.template.name}
                  </span>
                </td>
                <td className="py-3 pr-3 whitespace-nowrap text-secondary">{projectName}</td>
                <td className="py-3 pr-3">You</td>
                <td className="py-3 pr-3 whitespace-nowrap text-secondary">
                  {new Date(job._creationTime).toLocaleString()}
                </td>
                <td className="py-3 pr-3 whitespace-nowrap">{job.publishedDocumentId ? "Published" : job.status}</td>
                <td className="py-3 text-right">
                  <div className="inline-flex items-center gap-1">
                    <button
                      type="button"
                      title="Preview document"
                      disabled={busy}
                      onClick={() => onPreviewDocument(job)}
                      className="rounded-md p-1.5 text-secondary"
                    >
                      <Eye size={14} />
                    </button>
                    <CustomMenu ellipsis placement="bottom-end" disabled={busy}>
                      <CustomMenu.MenuItem onClick={() => onPreviewDocument(job)}>
                        <Eye size={12} />
                        View Preview
                      </CustomMenu.MenuItem>
                      <CustomMenu.MenuItem disabled={job.status !== "completed"} onClick={() => onPreviewDocument(job)}>
                        <Download size={12} />
                        Download files
                      </CustomMenu.MenuItem>
                      {canDelete && (
                        <CustomMenu.MenuItem disabled={job.status === "running"} onClick={() => onDeleteDocument(job)}>
                          <Trash2 size={12} />
                          Delete
                        </CustomMenu.MenuItem>
                      )}
                    </CustomMenu>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {loading && (
        <p role="status" className="text-xs py-4 text-secondary">
          Loading previews…
        </p>
      )}
      {exhausted && !documents.length && (
        <p className="text-xs py-8 text-center text-secondary">No documents found for this filter.</p>
      )}
      <div className="text-xs mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-subtle pt-3 text-secondary">
        <span>
          {documents.length} previews {exhausted ? "in this result" : "loaded"}
        </span>
        {onLoadMore && (
          <Button variant="secondary" disabled={busy} onClick={onLoadMore}>
            Load more documents
          </Button>
        )}
      </div>
    </div>
  );
}
