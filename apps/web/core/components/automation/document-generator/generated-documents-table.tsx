/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import React, { useState, useMemo } from "react";
import { Filter, Search } from "lucide-react";
import { cn } from "@plane/utils";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import { GeneratedDocumentRow } from "./generated-document-row";
import { GeneratedDocumentsPagination } from "./generated-documents-pagination";
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
  const paginatedDocs = filteredDocuments.slice((currentPage - 1) * pageSize, currentPage * pageSize);

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
              "flex items-center gap-1.5 rounded-lg border border-subtle px-3 py-1.5 text-xs font-medium text-secondary transition-colors hover:border-strong hover:text-primary",
              isFilterOpen && "border-strong bg-surface-2 text-primary"
            )}
          >
            <Filter size={13} />
            <span>Filters</span>
          </button>
        </div>
      </div>

      {/* Filter Bar (Collapsible) */}
      {isFilterOpen && (
        <div className="animate-in fade-in mt-3 flex flex-wrap items-center gap-3 rounded-lg border border-subtle bg-surface-2/60 p-2.5 duration-150">
          <div className="relative min-w-[200px] flex-1">
            <Search size={13} className="absolute top-1/2 left-2.5 -translate-y-1/2 text-placeholder" />
            <input
              type="text"
              aria-label="Search generated documents"
              placeholder="Search by title, context, or author…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-md border border-subtle bg-surface-1 py-1.5 pr-3 pl-8 text-xs text-primary outline-none placeholder:text-placeholder focus-visible:border-accent-strong"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-secondary">Status:</span>
            <select
              aria-label="Filter by status"
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="rounded-md border border-subtle bg-surface-1 px-2 py-1.5 text-xs text-primary outline-none focus-visible:border-accent-strong"
            >
              <option value="All">All Statuses</option>
              <option value="Completed">Completed</option>
              <option value="Draft">Draft</option>
            </select>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="hide-horizontal-scrollbar mt-3 flex overflow-x-auto border-b border-subtle">
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
                  isActive ? "font-semibold text-accent-primary" : "text-secondary hover:text-primary"
                )}
              >
                {tab.label}
                {isActive && <span className="absolute right-0 bottom-0 left-0 h-0.5 rounded-full bg-accent-primary" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Table Container */}
      <div className="mt-3 flex-1 overflow-x-auto">
        <table className="w-full min-w-[700px] border-collapse text-left">
          <thead>
            <tr className="border-b border-subtle text-[11px] font-semibold text-secondary">
              <th className="pb-2.5 pl-1 font-medium">Document</th>
              <th className="pb-2.5 font-medium">Type</th>
              <th className="pb-2.5 font-medium">Context</th>
              <th className="pb-2.5 font-medium">Created By</th>
              <th className="pb-2.5 font-medium">Created At</th>
              <th className="pb-2.5 font-medium">Status</th>
              <th className="pr-2 pb-2.5 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-subtle text-xs">
            {paginatedDocs.length > 0 ? (
              paginatedDocs.map((doc) => (
                <GeneratedDocumentRow
                  key={doc.id}
                  doc={doc}
                  isMenuOpen={actionMenuDocId === doc.id}
                  onToggleMenu={() => setActionMenuDocId(actionMenuDocId === doc.id ? null : doc.id)}
                  onCloseMenu={() => setActionMenuDocId(null)}
                  onPreviewDocument={onPreviewDocument}
                  onDownload={handleDownload}
                  onDelete={handleDelete}
                />
              ))
            ) : (
              <tr>
                <td colSpan={7} className="py-8 text-center text-xs text-secondary">
                  No documents found for this filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <GeneratedDocumentsPagination
        currentPage={currentPage}
        totalPages={totalPages}
        totalCount={filteredDocuments.length}
        pageSize={pageSize}
        onPageChange={setCurrentPage}
      />
    </div>
  );
};
