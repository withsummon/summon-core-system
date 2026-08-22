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
        iconClass: "text-blue-600 dark:text-blue-400",
        badge:
          "bg-blue-50 text-blue-600 border border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-800/60",
      };
    case "Note":
      return {
        icon: FileCode,
        iconClass: "text-emerald-600 dark:text-emerald-400",
        badge:
          "bg-emerald-50 text-emerald-600 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800/60",
      };
    case "Template":
      return {
        icon: BookOpen,
        iconClass: "text-purple-600 dark:text-purple-400",
        badge:
          "bg-purple-50 text-purple-600 border border-purple-200 dark:bg-purple-950/40 dark:text-purple-400 dark:border-purple-800/60",
      };
    case "Lesson Learned":
      return {
        icon: Lightbulb,
        iconClass: "text-orange-600 dark:text-orange-400",
        badge:
          "bg-orange-50 text-orange-600 border border-orange-200 dark:bg-orange-950/40 dark:text-orange-400 dark:border-orange-800/60",
      };
    case "Guide":
      return {
        icon: FileText,
        iconClass: "text-blue-600 dark:text-blue-400",
        badge:
          "bg-blue-50 text-blue-600 border border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-800/60",
      };
    case "FAQ":
      return {
        icon: HelpCircle,
        iconClass: "text-cyan-600 dark:text-cyan-400",
        badge:
          "bg-cyan-50 text-cyan-600 border border-cyan-200 dark:bg-cyan-950/40 dark:text-cyan-400 dark:border-cyan-800/60",
      };
    default:
      return {
        icon: FileText,
        iconClass: "text-blue-600",
        badge: "bg-blue-50 text-blue-600 border border-blue-200",
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
    <div className="shadow-xs flex flex-col rounded-xl border border-subtle bg-surface-1 p-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-primary">Recent Knowledge</h2>
        <button
          type="button"
          onClick={onViewAllKnowledge}
          className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 flex items-center gap-1 font-medium transition-colors"
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
                  "text-xs relative pb-2 font-medium whitespace-nowrap transition-colors",
                  isActive ? "text-blue-600 dark:text-blue-400 font-semibold" : "text-secondary hover:text-primary"
                )}
              >
                {tab.label}
                {isActive && (
                  <span className="bg-blue-600 dark:bg-blue-400 absolute right-0 bottom-0 left-0 h-0.5 rounded-full" />
                )}
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
          <tbody className="text-xs divide-y divide-subtle">
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
                          <p
                            onClick={() => onSelectItem?.(item)}
                            className="group-hover:text-blue-600 dark:group-hover:text-blue-400 cursor-pointer truncate font-semibold text-primary transition-colors"
                          >
                            {item.title}
                          </p>
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
                          <div className="bg-blue-600 flex size-5.5 items-center justify-center rounded-full text-[9px] font-bold text-white">
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
                          onClick={() => setMenuOpenId(isMenuOpen ? null : item.id)}
                          className="hover:bg-surface-3 rounded-md p-1.5 text-placeholder transition-colors hover:text-primary"
                        >
                          <MoreHorizontal size={14} />
                        </button>

                        {isMenuOpen && (
                          <div
                            className="shadow-lg absolute top-full right-0 z-40 mt-1 w-32 rounded-lg border border-subtle bg-surface-1 py-1 text-left"
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
                              className="text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 flex w-full items-center gap-2 px-3 py-1.5 text-[11px] transition-colors"
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
                <td colSpan={6} className="text-xs py-6 text-center text-secondary">
                  No knowledge items in this category.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      <div className="text-xs mt-4 flex items-center justify-between border-t border-subtle pt-3 text-secondary">
        <div>Showing 1 to {Math.min(pageSize, filteredItems.length)} of 156 knowledge items</div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={currentPage === 1}
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            className="flex size-7 items-center justify-center rounded-md border border-subtle bg-surface-1 text-placeholder transition-colors hover:border-strong hover:text-primary disabled:opacity-40"
          >
            <ChevronLeft size={13} />
          </button>
          <button
            type="button"
            onClick={() => setCurrentPage(1)}
            className={cn(
              "text-xs flex size-7 items-center justify-center rounded-md font-semibold transition-colors",
              currentPage === 1
                ? "bg-blue-600 shadow-xs text-white"
                : "border border-subtle bg-surface-1 text-primary hover:bg-surface-2"
            )}
          >
            1
          </button>
          <button
            type="button"
            onClick={() => setCurrentPage(2)}
            className="text-xs flex size-7 items-center justify-center rounded-md border border-subtle bg-surface-1 font-semibold text-primary hover:bg-surface-2"
          >
            2
          </button>
          <button
            type="button"
            onClick={() => setCurrentPage(3)}
            className="text-xs flex size-7 items-center justify-center rounded-md border border-subtle bg-surface-1 font-semibold text-primary hover:bg-surface-2"
          >
            3
          </button>
          <span className="px-1 text-placeholder">...</span>
          <button
            type="button"
            onClick={() => setCurrentPage(32)}
            className="text-xs flex size-7 items-center justify-center rounded-md border border-subtle bg-surface-1 font-semibold text-primary hover:bg-surface-2"
          >
            32
          </button>
          <button
            type="button"
            onClick={() => setCurrentPage((p) => Math.min(32, p + 1))}
            className="flex size-7 items-center justify-center rounded-md border border-subtle bg-surface-1 text-placeholder transition-colors hover:border-strong hover:text-primary"
          >
            <ChevronRight size={13} />
          </button>
        </div>
      </div>
    </div>
  );
};
