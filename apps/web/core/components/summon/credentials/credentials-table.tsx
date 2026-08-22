/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import React, { useState, useMemo } from "react";
import {
  Server,
  Cloud,
  Database,
  Key,
  Globe,
  HardDrive,
  MoreHorizontal,
  ChevronLeft,
  ChevronRight,
  List,
  LayoutGrid,
  ChevronDown,
} from "lucide-react";
import { cn } from "@plane/utils";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import type { ICredentialItem, TCredentialFilterTab, TCredentialType } from "./types";

interface ICredentialsTableProps {
  credentials: ICredentialItem[];
  selectedCredentialId: string;
  onSelectCredential: (id: string) => void;
  onDeleteCredential?: (id: string) => void;
}

const TABS: TCredentialFilterTab[] = [
  "All Credentials",
  "By Project",
  "By Type",
  "Shared With Me",
  "Recently Accessed",
];

const getTypeIcon = (type: TCredentialType) => {
  switch (type) {
    case "Server":
      return { icon: Server, color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-50 dark:bg-blue-950/40" };
    case "Cloud":
      return { icon: Cloud, color: "text-orange-600 dark:text-orange-400", bg: "bg-orange-50 dark:bg-orange-950/40" };
    case "Database":
      return { icon: Database, color: "text-cyan-600 dark:text-cyan-400", bg: "bg-cyan-50 dark:bg-cyan-950/40" };
    case "API Key":
      return { icon: Key, color: "text-rose-600 dark:text-rose-400", bg: "bg-rose-50 dark:bg-rose-950/40" };
    case "SaaS":
      return { icon: Globe, color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-950/40" };
    case "Storage":
      return { icon: HardDrive, color: "text-indigo-600 dark:text-indigo-400", bg: "bg-indigo-50 dark:bg-indigo-950/40" };
    default:
      return { icon: Server, color: "text-blue-600", bg: "bg-blue-50" };
  }
};

export const CredentialsTable: React.FC<ICredentialsTableProps> = ({
  credentials,
  selectedCredentialId,
  onSelectCredential,
  onDeleteCredential,
}) => {
  const [activeTab, setActiveTab] = useState<TCredentialFilterTab>("All Credentials");
  const [projectFilter, setProjectFilter] = useState("All Projects");
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const [currentPage, setCurrentPage] = useState(1);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  const projectsList = useMemo(() => {
    const set = new Set(credentials.map((c) => c.project));
    return ["All Projects", ...Array.from(set)];
  }, [credentials]);

  const filteredCredentials = useMemo(() => {
    return credentials.filter((cred) => {
      if (projectFilter !== "All Projects" && cred.project !== projectFilter) {
        return false;
      }
      if (activeTab === "Shared With Me" && cred.accessSummary.usersWithAccess <= 3) {
        return false;
      }
      if (activeTab === "Recently Accessed" && !cred.lastUsed.includes("hour")) {
        return false;
      }
      return true;
    });
  }, [credentials, projectFilter, activeTab]);

  return (
    <div className="flex flex-col rounded-xl border border-subtle bg-surface-1 shadow-xs overflow-hidden h-full">
      {/* Tab Navigation */}
      <div className="flex border-b border-subtle px-4 bg-surface-1 overflow-x-auto hide-horizontal-scrollbar">
        <div className="flex gap-4">
          {TABS.map((tab) => {
            const isActive = activeTab === tab;
            return (
              <button
                key={tab}
                type="button"
                onClick={() => {
                  setActiveTab(tab);
                  setCurrentPage(1);
                }}
                className={cn(
                  "relative py-3 text-xs font-medium whitespace-nowrap transition-colors",
                  isActive
                    ? "text-blue-600 dark:text-blue-400 font-semibold"
                    : "text-secondary hover:text-primary"
                )}
              >
                {tab}
                {isActive && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full bg-blue-600 dark:bg-blue-400" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Filter Row & View Toggle */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 px-4 py-2.5 bg-surface-2/30 border-b border-subtle">
        {/* Project Selector */}
        <div className="relative">
          <select
            value={projectFilter}
            onChange={(e) => setProjectFilter(e.target.value)}
            className="rounded-lg border border-subtle bg-surface-1 px-3 py-1.5 text-xs font-medium text-primary shadow-2xs focus:border-blue-500 focus:outline-none"
          >
            {projectsList.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>

        {/* Count & View Toggle Buttons */}
        <div className="flex items-center gap-3">
          <span className="text-xs text-secondary">
            {filteredCredentials.length} credentials
          </span>

          <div className="flex items-center rounded-lg border border-subtle bg-surface-1 p-0.5 shadow-2xs">
            <button
              type="button"
              onClick={() => setViewMode("list")}
              className={cn(
                "rounded-md p-1 transition-colors",
                viewMode === "list" ? "bg-surface-3 text-primary" : "text-secondary hover:text-primary"
              )}
            >
              <List size={14} />
            </button>
            <button
              type="button"
              onClick={() => setViewMode("grid")}
              className={cn(
                "rounded-md p-1 transition-colors",
                viewMode === "grid" ? "bg-surface-3 text-primary" : "text-secondary hover:text-primary"
              )}
            >
              <LayoutGrid size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Table Content */}
      <div className="flex-1 overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[700px]">
          <thead>
            <tr className="border-b border-subtle text-[11px] font-semibold text-secondary bg-surface-2/20">
              <th className="py-2.5 pl-4 font-medium">Credential Name</th>
              <th className="py-2.5 font-medium">Type</th>
              <th className="py-2.5 font-medium">Project</th>
              <th className="py-2.5 font-medium">Environment</th>
              <th className="py-2.5 font-medium">Last Used</th>
              <th className="py-2.5 font-medium">Status</th>
              <th className="py-2.5 font-medium text-right pr-4">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-subtle text-xs">
            {filteredCredentials.map((cred) => {
              const isSelected = selectedCredentialId === cred.id;
              const { icon: IconComp, color, bg } = getTypeIcon(cred.type);
              const isMenuOpen = activeMenuId === cred.id;

              return (
                <tr
                  key={cred.id}
                  onClick={() => onSelectCredential(cred.id)}
                  className={cn(
                    "group transition-colors cursor-pointer",
                    isSelected
                      ? "bg-blue-50/50 dark:bg-blue-950/30 border-l-3 border-blue-600"
                      : "hover:bg-surface-2/60"
                  )}
                >
                  {/* Credential Name */}
                  <td className="py-3 pl-4 pr-3">
                    <div className="flex items-center gap-2.5">
                      <div className={cn("flex size-8 shrink-0 items-center justify-center rounded-lg border border-subtle", bg, color)}>
                        <IconComp size={15} />
                      </div>
                      <div className="min-w-0 max-w-[200px] xl:max-w-[240px]">
                        <p className={cn("font-semibold truncate", isSelected ? "text-blue-600 dark:text-blue-400" : "text-primary")}>
                          {cred.name}
                        </p>
                        <p className="text-[11px] text-secondary truncate font-mono mt-0.5">
                          {cred.identifier}
                        </p>
                      </div>
                    </div>
                  </td>

                  {/* Type */}
                  <td className="py-3 pr-3 text-[11px] text-secondary whitespace-nowrap">
                    {cred.type}
                  </td>

                  {/* Project */}
                  <td className="py-3 pr-3 text-[11px] text-secondary whitespace-nowrap max-w-[160px] truncate">
                    {cred.project}
                  </td>

                  {/* Environment */}
                  <td className="py-3 pr-3 whitespace-nowrap">
                    <span
                      className={cn(
                        "inline-block rounded-full px-2 py-0.5 text-[10px] font-medium",
                        cred.environment === "Production"
                          ? "bg-emerald-50 text-emerald-600 border border-emerald-200 dark:bg-emerald-950/40 dark:border-emerald-800"
                          : "bg-blue-50 text-blue-600 border border-blue-200 dark:bg-blue-950/40 dark:border-blue-800"
                      )}
                    >
                      {cred.environment}
                    </span>
                  </td>

                  {/* Last Used */}
                  <td className="py-3 pr-3 text-[11px] text-secondary whitespace-nowrap">
                    {cred.lastUsed}
                  </td>

                  {/* Status */}
                  <td className="py-3 pr-3 whitespace-nowrap">
                    <div className="flex items-center gap-1.5 text-[11px] font-medium">
                      <span
                        className={cn(
                          "size-1.5 rounded-full",
                          cred.status === "active" ? "bg-emerald-500" : "bg-amber-500"
                        )}
                      />
                      <span
                        className={cn(
                          cred.status === "active"
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-amber-600 dark:text-amber-400"
                        )}
                      >
                        {cred.status === "active" ? "Active" : "Expiring soon"}
                      </span>
                    </div>
                  </td>

                  {/* Actions */}
                  <td className="py-3 pr-4 text-right whitespace-nowrap">
                    <div className="relative inline-flex items-center">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveMenuId(isMenuOpen ? null : cred.id);
                        }}
                        className="rounded p-1 text-placeholder hover:bg-surface-3 hover:text-primary transition-colors"
                      >
                        <MoreHorizontal size={14} />
                      </button>

                      {isMenuOpen && (
                        <div
                          className="absolute right-0 top-full z-40 mt-1 w-32 rounded-lg border border-subtle bg-surface-1 py-1 shadow-lg text-left"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            onClick={() => {
                              setActiveMenuId(null);
                              onSelectCredential(cred.id);
                            }}
                            className="flex w-full items-center px-3 py-1.5 text-[11px] text-primary hover:bg-surface-2 transition-colors"
                          >
                            <span>View Details</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setActiveMenuId(null);
                              setToast({
                                type: TOAST_TYPE.INFO,
                                title: "Password Copied",
                                message: `Password for ${cred.name} copied.`,
                              });
                            }}
                            className="flex w-full items-center px-3 py-1.5 text-[11px] text-primary hover:bg-surface-2 transition-colors"
                          >
                            <span>Copy Password</span>
                          </button>
                          <div className="my-1 border-t border-subtle" />
                          <button
                            type="button"
                            onClick={() => {
                              setActiveMenuId(null);
                              onDeleteCredential?.(cred.id);
                              setToast({
                                type: TOAST_TYPE.SUCCESS,
                                title: "Credential Deleted",
                                message: `${cred.name} was removed from vault.`,
                              });
                            }}
                            className="flex w-full items-center px-3 py-1.5 text-[11px] text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
                          >
                            <span>Delete</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-subtle px-4 py-3 bg-surface-1 text-xs text-secondary">
        <div>
          Showing 1 to {Math.min(8, filteredCredentials.length)} of {filteredCredentials.length} credentials
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
          {[1, 2, 3, 4].map((page) => (
            <button
              key={page}
              type="button"
              onClick={() => setCurrentPage(page)}
              className={cn(
                "flex size-7 items-center justify-center rounded-md text-xs font-semibold transition-colors",
                currentPage === page
                  ? "bg-blue-600 text-white shadow-xs"
                  : "border border-subtle bg-surface-1 text-primary hover:bg-surface-2"
              )}
            >
              {page}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setCurrentPage((p) => Math.min(4, p + 1))}
            className="flex size-7 items-center justify-center rounded-md border border-subtle bg-surface-1 text-placeholder hover:border-strong hover:text-primary transition-colors"
          >
            <ChevronRight size={13} />
          </button>
        </div>

        <div className="flex items-center gap-1 text-secondary">
          <span>Rows per page:</span>
          <select className="rounded border border-subtle bg-surface-1 py-0.5 px-1.5 text-xs text-primary focus:outline-none">
            <option value="10">10</option>
            <option value="20">20</option>
            <option value="50">50</option>
          </select>
        </div>
      </div>
    </div>
  );
};
