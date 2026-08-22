/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import React, { useState, useMemo } from "react";
import {
  Filter,
  Eye,
  MoreHorizontal,
  Check,
  ChevronLeft,
  ChevronRight,
  Search,
  Download,
  Trash2,
} from "lucide-react";
import { cn } from "@plane/utils";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import { TypeIcon, getDocumentTypeTheme } from "./type-icon";
import type { IGeneratedDocument } from "./types";

interface IGeneratedDocumentsTableProps {
  documents: IGeneratedDocument[];
  onPreviewDocument: (doc: IGeneratedDocument) => void;
  onDeleteDocument?: (docId: string) => void;
}

const TABS: { label: string; value: string }[] = [
  { label: "All", value: "All" },
  { label: "Technical Proposal", value: "Technical Proposal" },
  { label: "Quotation", value: "Quotation" },
  { label: "MoM", value: "MoM" },
  { label: "Presentation", value: "Presentation" },
  { label: "Cost Projection", value: "Cost Projection" },
  { label: "POC Brief", value: "POC Brief" },
];

export const GeneratedDocumentsTable: React.FC<IGeneratedDocumentsTableProps> = ({
  documents,
  onPreviewDocument,
  onDeleteDocument,
}) => {
  const [activeTab, setActiveTab] = useState<string>("All");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [isFilterOpen, setIsFilterOpen] = useState<boolean>(false);
  const [selectedStatus, setSelectedStatus] = useState<string>("All");
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [actionMenuDocId, setActionMenuDocId] = useState<string | null>(null);

  const pageSize = 8;

  // Filter documents
  const filteredDocuments = useMemo(() => {
    return documents.filter((doc) => {
      // Tab filter
      if (activeTab !== "All" && doc.type !== activeTab) {
        return false;
      }
      // Status filter
      if (selectedStatus !== "All" && doc.status !== selectedStatus) {
        return false;
      }
      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = doc.title.toLowerCase().includes(q);
        const matchContext = doc.context.toLowerCase().includes(q);
        const matchAuthor = doc.createdBy.name.toLowerCase().includes(q);
        const matchDesc = doc.description.toLowerCase().includes(q);
        if (!matchTitle && !matchContext && !matchAuthor && !matchDesc) {
          return false;
        }
      }
      return true;
    });
  }, [documents, activeTab, selectedStatus, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredDocuments.length / pageSize));
  const paginatedDocs = filteredDocuments.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  const handleDownload = (doc: IGeneratedDocument) => {
    setActionMenuDocId(null);
    setToast({
      type: TOAST_TYPE.SUCCESS,
      title: "Download Started",
      message: `Downloading ${doc.title}.${doc.format?.toLowerCase() || "docx"}`,
    });
  };

  const handleDelete = (doc: IGeneratedDocument) => {
    setActionMenuDocId(null);
    onDeleteDocument?.(doc.id);
    setToast({
      type: TOAST_TYPE.SUCCESS,
      title: "Document Deleted",
      message: `${doc.title} was removed.`,
    });
  };

  return (
    <div className="flex h-full flex-col rounded-xl border border-subtle bg-surface-1 p-5 shadow-xs">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-primary">Generated Documents</h2>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsFilterOpen(!isFilterOpen)}
            className={cn(
              "flex items-center gap-1.5 rounded-lg border border-subtle px-3 py-1.5 text-xs font-medium text-secondary hover:border-strong hover:text-primary transition-colors",
              isFilterOpen && "bg-surface-2 border-strong text-primary"
            )}
          >
            <Filter size={13} />
            <span>Filters</span>
          </button>
        </div>
      </div>

      {/* Filter Bar (Collapsible) */}
      {isFilterOpen && (
        <div className="mt-3 flex flex-wrap items-center gap-3 rounded-lg border border-subtle bg-surface-2/60 p-2.5 animate-in fade-in duration-150">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-placeholder" />
            <input
              type="text"
              placeholder="Search by title, context, or author..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-md border border-subtle bg-surface-1 py-1.5 pl-8 pr-3 text-xs text-primary placeholder:text-placeholder focus:border-blue-500 focus:outline-none"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-secondary">Status:</span>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="rounded-md border border-subtle bg-surface-1 py-1.5 px-2 text-xs text-primary focus:border-blue-500 focus:outline-none"
            >
              <option value="All">All Statuses</option>
              <option value="Completed">Completed</option>
              <option value="Draft">Draft</option>
            </select>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="mt-3 flex border-b border-subtle overflow-x-auto hide-horizontal-scrollbar">
        <div className="flex gap-4">
          {TABS.map((tab) => {
            const isActive = activeTab === tab.value;
            return (
              <button
                key={tab.value}
                type="button"
                onClick={() => {
                  setActiveTab(tab.value);
                  setCurrentPage(1);
                }}
                className={cn(
                  "relative pb-2.5 text-xs font-medium whitespace-nowrap transition-colors",
                  isActive
                    ? "text-blue-600 dark:text-blue-400 font-semibold"
                    : "text-secondary hover:text-primary"
                )}
              >
                {tab.label}
                {isActive && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full bg-blue-600 dark:bg-blue-400" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Table Container */}
      <div className="mt-3 flex-1 overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[700px]">
          <thead>
            <tr className="border-b border-subtle text-[11px] font-semibold text-secondary">
              <th className="pb-2.5 font-medium pl-1">Document</th>
              <th className="pb-2.5 font-medium">Type</th>
              <th className="pb-2.5 font-medium">Context</th>
              <th className="pb-2.5 font-medium">Created By</th>
              <th className="pb-2.5 font-medium">Created At</th>
              <th className="pb-2.5 font-medium">Status</th>
              <th className="pb-2.5 font-medium text-right pr-2">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-subtle text-xs">
            {paginatedDocs.length > 0 ? (
              paginatedDocs.map((doc) => {
                const theme = getDocumentTypeTheme(doc.type);
                const isMenuOpen = actionMenuDocId === doc.id;

                return (
                  <tr
                    key={doc.id}
                    className="group hover:bg-surface-2/60 transition-colors"
                  >
                    {/* Document Info */}
                    <td className="py-3 pl-1 pr-3">
                      <div className="flex items-start gap-2.5">
                        <TypeIcon type={doc.type} size={16} className="mt-0.5 shrink-0" />
                        <div className="max-w-[200px] xl:max-w-[240px]">
                          <p
                            onClick={() => onPreviewDocument(doc)}
                            className="font-semibold text-primary group-hover:text-blue-600 dark:group-hover:text-blue-400 cursor-pointer transition-colors truncate"
                          >
                            {doc.title}
                          </p>
                          <p className="text-[11px] text-secondary truncate mt-0.5">
                            {doc.description}
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* Type Badge */}
                    <td className="py-3 pr-3 whitespace-nowrap">
                      <span
                        className={cn(
                          "inline-block rounded-full px-2.5 py-0.5 text-[10px] font-medium",
                          theme.badgeBg
                        )}
                      >
                        {doc.type}
                      </span>
                    </td>

                    {/* Context */}
                    <td className="py-3 pr-3 text-secondary whitespace-nowrap text-[11px]">
                      {doc.context}
                    </td>

                    {/* Created By */}
                    <td className="py-3 pr-3 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        {doc.createdBy.avatar ? (
                          <img
                            src={doc.createdBy.avatar}
                            alt={doc.createdBy.name}
                            className="size-5.5 rounded-full object-cover ring-1 ring-subtle"
                          />
                        ) : (
                          <div className="flex size-5.5 items-center justify-center rounded-full bg-blue-600 text-[9px] font-bold text-white">
                            {doc.createdBy.initials}
                          </div>
                        )}
                        <span className="text-[11px] font-medium text-primary">
                          {doc.createdBy.name}
                        </span>
                      </div>
                    </td>

                    {/* Created At */}
                    <td className="py-3 pr-3 text-[11px] text-secondary whitespace-nowrap">
                      {doc.createdAt}
                    </td>

                    {/* Status */}
                    <td className="py-3 pr-3 whitespace-nowrap">
                      {doc.status === "Completed" ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-600 dark:border-emerald-800/60 dark:bg-emerald-950/40 dark:text-emerald-400">
                          <Check size={11} strokeWidth={2.5} />
                          <span>Completed</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50/50 px-2.5 py-0.5 text-[10px] font-medium text-blue-600 dark:border-blue-900/60 dark:bg-blue-950/30 dark:text-blue-400">
                          Draft
                        </span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="py-3 pr-2 text-right whitespace-nowrap">
                      <div className="relative inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => onPreviewDocument(doc)}
                          title="Preview document"
                          className="rounded-md p-1.5 text-placeholder hover:bg-surface-3 hover:text-primary transition-colors"
                        >
                          <Eye size={14} />
                        </button>

                        <button
                          type="button"
                          onClick={() => setActionMenuDocId(isMenuOpen ? null : doc.id)}
                          title="More options"
                          className="rounded-md p-1.5 text-placeholder hover:bg-surface-3 hover:text-primary transition-colors"
                        >
                          <MoreHorizontal size={14} />
                        </button>

                        {/* Action Dropdown Menu */}
                        {isMenuOpen && (
                          <div
                            className="absolute right-0 top-full z-40 mt-1 w-36 rounded-lg border border-subtle bg-surface-1 py-1 shadow-lg text-left"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              type="button"
                              onClick={() => {
                                setActionMenuDocId(null);
                                onPreviewDocument(doc);
                              }}
                              className="flex w-full items-center gap-2 px-3 py-1.5 text-[11px] text-primary hover:bg-surface-2 transition-colors"
                            >
                              <Eye size={12} />
                              <span>View Preview</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDownload(doc)}
                              className="flex w-full items-center gap-2 px-3 py-1.5 text-[11px] text-primary hover:bg-surface-2 transition-colors"
                            >
                              <Download size={12} />
                              <span>Download</span>
                            </button>
                            <div className="my-1 border-t border-subtle" />
                            <button
                              type="button"
                              onClick={() => handleDelete(doc)}
                              className="flex w-full items-center gap-2 px-3 py-1.5 text-[11px] text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
                            >
                              <Trash2 size={12} />
                              <span>Delete</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={7} className="py-8 text-center text-secondary text-xs">
                  No documents found for this filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      <div className="mt-4 flex items-center justify-between border-t border-subtle pt-3 text-xs text-secondary">
        <div>
          Showing {Math.min(1, filteredDocuments.length)} to{" "}
          {Math.min(pageSize, filteredDocuments.length)} of {filteredDocuments.length} documents
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={currentPage === 1}
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            className="flex size-7 items-center justify-center rounded-md border border-subtle bg-surface-1 text-placeholder hover:border-strong hover:text-primary disabled:opacity-40 transition-colors"
          >
            <ChevronLeft size={13} />
          </button>

          <button
            type="button"
            onClick={() => setCurrentPage(1)}
            className={cn(
              "flex size-7 items-center justify-center rounded-md text-xs font-semibold transition-colors",
              currentPage === 1
                ? "bg-blue-600 text-white shadow-xs"
                : "border border-subtle bg-surface-1 text-primary hover:bg-surface-2"
            )}
          >
            1
          </button>

          {totalPages >= 2 && (
            <button
              type="button"
              onClick={() => setCurrentPage(2)}
              className={cn(
                "flex size-7 items-center justify-center rounded-md text-xs font-semibold transition-colors",
                currentPage === 2
                  ? "bg-blue-600 text-white shadow-xs"
                  : "border border-subtle bg-surface-1 text-primary hover:bg-surface-2"
              )}
            >
              2
            </button>
          )}

          {totalPages >= 3 && (
            <button
              type="button"
              onClick={() => setCurrentPage(3)}
              className={cn(
                "flex size-7 items-center justify-center rounded-md text-xs font-semibold transition-colors",
                currentPage === 3
                  ? "bg-blue-600 text-white shadow-xs"
                  : "border border-subtle bg-surface-1 text-primary hover:bg-surface-2"
              )}
            >
              3
            </button>
          )}

          {totalPages > 4 && <span className="px-1 text-placeholder">...</span>}

          {totalPages > 3 && (
            <button
              type="button"
              onClick={() => setCurrentPage(totalPages)}
              className={cn(
                "flex size-7 items-center justify-center rounded-md text-xs font-semibold transition-colors",
                currentPage === totalPages
                  ? "bg-blue-600 text-white shadow-xs"
                  : "border border-subtle bg-surface-1 text-primary hover:bg-surface-2"
              )}
            >
              {totalPages}
            </button>
          )}

          <button
            type="button"
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            className="flex size-7 items-center justify-center rounded-md border border-subtle bg-surface-1 text-placeholder hover:border-strong hover:text-primary disabled:opacity-40 transition-colors"
          >
            <ChevronRight size={13} />
          </button>
        </div>
      </div>
    </div>
  );
};
