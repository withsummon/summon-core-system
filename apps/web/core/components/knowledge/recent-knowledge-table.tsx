/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import React, { useState, useMemo } from "react";
import {
  FileText,
  FileCode,
  BookOpen,
  HelpCircle,
  Lightbulb,
  ArrowRight,
  MoreHorizontal,
  ChevronLeft,
  ChevronRight,
  Eye,
  Download,
  Trash2,
} from "lucide-react";
import { cn } from "@plane/utils";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import type { IKnowledgeItem, TKnowledgeCategory, TKnowledgeItemType } from "./types";

interface IRecentKnowledgeTableProps {
  items: IKnowledgeItem[];
  onSelectItem?: (item: IKnowledgeItem) => void;
  onViewAllKnowledge?: () => void;
  onDeleteItem?: (id: string) => void;
}

const TABS: { label: string; value: TKnowledgeCategory }[] = [
  { label: "All", value: "All" },
  { label: "Notes", value: "Notes" },
  { label: "Documents", value: "Documents" },
  { label: "Guides", value: "Guides" },
  { label: "FAQs", value: "FAQs" },
  { label: "Lessons Learned", value: "Lessons Learned" },
];

const getTypeStyle = (type: TKnowledgeItemType) => {
  switch (type) {
    case "Document":
      return {
        icon: FileText,
        iconClass: "text-label-indigo-icon",
        badge: "bg-label-indigo-bg text-label-indigo-text border border-label-indigo-border",
      };
    case "Note":
      return {
        icon: FileCode,
        iconClass: "text-label-emerald-icon",
        badge: "bg-label-emerald-bg text-label-emerald-text border border-label-emerald-border",
      };
    case "Template":
      return {
        icon: BookOpen,
        iconClass: "text-label-purple-icon",
        badge: "bg-label-purple-bg text-label-purple-text border border-label-purple-border",
      };
    case "Lesson Learned":
      return {
        icon: Lightbulb,
        iconClass: "text-label-orange-icon",
        badge: "bg-label-orange-bg text-label-orange-text border border-label-orange-border",
      };
    case "Guide":
      return {
        icon: FileText,
        iconClass: "text-label-pink-icon",
        badge: "bg-label-pink-bg text-label-pink-text border border-label-pink-border",
      };
    case "FAQ":
      return {
        icon: HelpCircle,
        iconClass: "text-label-yellow-icon",
        badge: "bg-label-yellow-bg text-label-yellow-text border border-label-yellow-border",
      };
    default:
      return {
        icon: FileText,
        iconClass: "text-label-grey-icon",
        badge: "bg-label-grey-bg text-label-grey-text border border-label-grey-border",
      };
  }
};

export const RecentKnowledgeTable: React.FC<IRecentKnowledgeTableProps> = ({
  items,
  onSelectItem,
  onViewAllKnowledge,
  onDeleteItem,
}) => {
  const [activeTab, setActiveTab] = useState<TKnowledgeCategory>("All");
  const [currentPage, setCurrentPage] = useState(1);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);

  const pageSize = 5;

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (activeTab === "All") return true;
      if (activeTab === "Notes" && item.type === "Note") return true;
      if (activeTab === "Documents" && item.type === "Document") return true;
      if (activeTab === "Guides" && (item.type === "Guide" || item.type === "Template")) return true;
      if (activeTab === "FAQs" && item.type === "FAQ") return true;
      if (activeTab === "Lessons Learned" && item.type === "Lesson Learned") return true;
      return false;
    });
  }, [items, activeTab]);

  const paginatedItems = filteredItems.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <div className="flex flex-col rounded-xl border border-subtle bg-surface-1 p-5 shadow-xs">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-primary">Recent Knowledge</h2>
        <button
          type="button"
          onClick={onViewAllKnowledge}
          className="flex items-center gap-1 text-xs font-medium text-link-primary transition-colors hover:text-link-primary-hover"
        >
          <span>View all knowledge</span>
          <ArrowRight size={13} />
        </button>
      </div>

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
                  "relative pb-2 text-xs font-medium whitespace-nowrap transition-colors",
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

      {/* Table */}
      <div className="mt-2 overflow-x-auto">
        <table className="w-full min-w-[650px] border-collapse text-left">
          <thead>
            <tr className="border-b border-subtle text-[11px] font-semibold text-secondary">
              <th className="py-2.5 pl-1 font-medium">Title</th>
              <th className="py-2.5 font-medium">Context</th>
              <th className="py-2.5 font-medium">Type</th>
              <th className="py-2.5 font-medium">Updated</th>
              <th className="py-2.5 font-medium">Updated by</th>
              <th className="py-2.5 pr-2 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-subtle text-xs">
            {paginatedItems.length > 0 ? (
              paginatedItems.map((item) => {
                const { icon: IconComp, iconClass, badge } = getTypeStyle(item.type);
                const isMenuOpen = menuOpenId === item.id;

                return (
                  <tr key={item.id} className="group transition-colors hover:bg-surface-2/60">
                    {/* Title */}
                    <td className="py-3 pr-3 pl-1">
                      <div className="flex items-start gap-2.5">
                        <IconComp size={16} className={cn("mt-0.5 shrink-0", iconClass)} />
                        <div className="max-w-[220px] xl:max-w-[260px]">
                          <button
                            type="button"
                            onClick={() => onSelectItem?.(item)}
                            title={item.title}
                            className="block w-full cursor-pointer truncate text-left font-semibold text-primary transition-colors group-hover:text-accent-primary"
                          >
                            {item.title}
                          </button>
                          <p className="mt-0.5 truncate text-[11px] text-secondary">{item.description}</p>
                        </div>
                      </div>
                    </td>

                    {/* Context */}
                    <td className="py-3 pr-3 text-[11px] whitespace-nowrap text-secondary">{item.context}</td>

                    {/* Type Badge */}
                    <td className="py-3 pr-3 whitespace-nowrap">
                      <span className={cn("inline-block rounded-full px-2.5 py-0.5 text-[10px] font-medium", badge)}>
                        {item.type}
                      </span>
                    </td>

                    {/* Updated */}
                    <td className="py-3 pr-3 text-[11px] whitespace-nowrap text-secondary">{item.updatedAt}</td>

                    {/* Updated by */}
                    <td className="py-3 pr-3 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        {item.updatedBy.avatar ? (
                          <img
                            src={item.updatedBy.avatar}
                            alt={item.updatedBy.name}
                            className="size-5.5 rounded-full object-cover ring-1 ring-subtle"
                          />
                        ) : (
                          <div className="flex size-5.5 items-center justify-center rounded-full bg-label-indigo-bg-strong text-[9px] font-bold text-on-color">
                            {item.updatedBy.initials}
                          </div>
                        )}
                        <span className="text-[11px] font-medium text-primary">{item.updatedBy.name}</span>
                      </div>
                    </td>

                    {/* Actions */}
                    <td className="py-3 pr-2 text-right whitespace-nowrap">
                      <div className="relative inline-flex items-center">
                        <button
                          type="button"
                          aria-label="More actions"
                          onClick={() => setMenuOpenId(isMenuOpen ? null : item.id)}
                          className="hover:bg-surface-3 rounded-md p-1.5 text-placeholder transition-colors hover:text-primary"
                        >
                          <MoreHorizontal size={14} />
                        </button>

                        {isMenuOpen && (
                          <div
                            className="absolute top-full right-0 z-40 mt-1 w-32 rounded-lg border border-subtle bg-surface-1 py-1 text-left shadow-lg"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              type="button"
                              onClick={() => {
                                setMenuOpenId(null);
                                onSelectItem?.(item);
                              }}
                              className="flex w-full items-center gap-2 px-3 py-1.5 text-[11px] text-primary transition-colors hover:bg-surface-2"
                            >
                              <Eye size={12} />
                              <span>View Detail</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setMenuOpenId(null);
                                setToast({
                                  type: TOAST_TYPE.SUCCESS,
                                  title: "Exporting",
                                  message: `Exporting ${item.title}`,
                                });
                              }}
                              className="flex w-full items-center gap-2 px-3 py-1.5 text-[11px] text-primary transition-colors hover:bg-surface-2"
                            >
                              <Download size={12} />
                              <span>Export</span>
                            </button>
                            <div className="my-1 border-t border-subtle" />
                            <button
                              type="button"
                              onClick={() => {
                                setMenuOpenId(null);
                                onDeleteItem?.(item.id);
                                setToast({
                                  type: TOAST_TYPE.SUCCESS,
                                  title: "Deleted",
                                  message: `${item.title} was removed.`,
                                });
                              }}
                              className="flex w-full items-center gap-2 px-3 py-1.5 text-[11px] text-danger-primary transition-colors hover:bg-danger-subtle"
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
                <td colSpan={6} className="py-6 text-center text-xs text-secondary">
                  No knowledge items in this category.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      <div className="mt-4 flex items-center justify-between border-t border-subtle pt-3 text-xs text-secondary">
        <div className="tabular-nums">
          Showing 1 to {Math.min(pageSize, filteredItems.length)} of 156 knowledge items
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={currentPage === 1}
            aria-label="Previous page"
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            className="flex size-7 items-center justify-center rounded-md border border-subtle bg-surface-1 text-placeholder transition-colors hover:border-strong hover:text-primary disabled:opacity-40"
          >
            <ChevronLeft size={13} />
          </button>
          <button
            type="button"
            onClick={() => setCurrentPage(1)}
            className={cn(
              "flex size-7 items-center justify-center rounded-md text-xs font-semibold transition-colors",
              currentPage === 1
                ? "bg-accent-primary text-on-color shadow-xs"
                : "border border-subtle bg-surface-1 text-primary hover:bg-surface-2"
            )}
          >
            1
          </button>
          <button
            type="button"
            onClick={() => setCurrentPage(2)}
            className="flex size-7 items-center justify-center rounded-md border border-subtle bg-surface-1 text-xs font-semibold text-primary hover:bg-surface-2"
          >
            2
          </button>
          <button
            type="button"
            onClick={() => setCurrentPage(3)}
            className="flex size-7 items-center justify-center rounded-md border border-subtle bg-surface-1 text-xs font-semibold text-primary hover:bg-surface-2"
          >
            3
          </button>
          <span className="px-1 text-placeholder">…</span>
          <button
            type="button"
            onClick={() => setCurrentPage(32)}
            className="flex size-7 items-center justify-center rounded-md border border-subtle bg-surface-1 text-xs font-semibold text-primary hover:bg-surface-2"
          >
            32
          </button>
          <button
            type="button"
            onClick={() => setCurrentPage((p) => Math.min(32, p + 1))}
            aria-label="Next page"
            className="flex size-7 items-center justify-center rounded-md border border-subtle bg-surface-1 text-placeholder transition-colors hover:border-strong hover:text-primary"
          >
            <ChevronRight size={13} />
          </button>
        </div>
      </div>
    </div>
  );
};
