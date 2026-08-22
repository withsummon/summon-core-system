/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import React from "react";
import { Search, Bell, FileText, Filter, Plus } from "lucide-react";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";

interface IOpportunitiesHeaderProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onOpenNewModal: () => void;
  onToggleFilters?: () => void;
}

export const OpportunitiesHeader: React.FC<IOpportunitiesHeaderProps> = ({
  searchQuery,
  onSearchChange,
  onOpenNewModal,
  onToggleFilters,
}) => {
  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 w-full">
      {/* Title & Subtitle */}
      <div>
        <h1 className="text-xl font-bold tracking-tight text-primary">Opportunities</h1>
        <p className="text-xs text-secondary mt-0.5">Manage your pipeline and win more deals</p>
      </div>

      {/* Middle & Right Controls */}
      <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
        {/* Search Bar */}
        <div className="relative flex-1 sm:w-80">
          <div className="flex items-center rounded-xl border border-subtle bg-surface-1 px-3 py-1.5 shadow-2xs focus-within:border-blue-500 transition-all">
            <Search size={14} className="text-placeholder mr-2 shrink-0" />
            <input
              type="text"
              placeholder="Search opportunities, clients, products..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full bg-transparent text-xs text-primary placeholder:text-placeholder focus:outline-none"
            />
            <span className="hidden sm:inline-block rounded border border-subtle bg-surface-2 px-1.5 py-0.5 text-[9px] font-medium text-secondary">
              ⌘ K
            </span>
          </div>
        </div>

        {/* Action icons */}
        <div className="flex items-center gap-2">
          {/* Notifications */}
          <button
            type="button"
            onClick={() =>
              setToast({
                type: TOAST_TYPE.INFO,
                title: "Notifications",
                message: "1 new update on Pegadaian opportunity.",
              })
            }
            className="relative flex size-8 items-center justify-center rounded-full border border-subtle bg-surface-1 text-secondary hover:text-primary transition-colors shadow-2xs"
          >
            <Bell size={14} />
            <span className="absolute -top-0.5 -right-0.5 flex size-3.5 items-center justify-center rounded-full bg-red-500 text-[8px] font-bold text-white">
              1
            </span>
          </button>

          {/* Notes */}
          <button
            type="button"
            onClick={() =>
              setToast({
                type: TOAST_TYPE.INFO,
                title: "Opportunity Notes",
                message: "Opening opportunity notes drawer.",
              })
            }
            className="flex size-8 items-center justify-center rounded-full border border-subtle bg-surface-1 text-secondary hover:text-primary transition-colors shadow-2xs"
          >
            <FileText size={14} />
          </button>

          {/* User Avatar */}
          <div className="flex size-8 items-center justify-center rounded-full border border-subtle bg-surface-2 overflow-hidden shadow-2xs">
            <img
              src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80"
              alt="User"
              className="size-full object-cover"
            />
          </div>

          {/* Filters Button */}
          <button
            type="button"
            onClick={onToggleFilters}
            className="flex items-center gap-1.5 rounded-lg border border-subtle bg-surface-1 px-3 py-1.5 text-xs font-medium text-secondary hover:border-strong hover:text-primary transition-colors shadow-2xs"
          >
            <Filter size={13} />
            <span>Filters</span>
          </button>

          {/* New Opportunity Button */}
          <button
            type="button"
            onClick={onOpenNewModal}
            className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 transition-colors shadow-xs"
          >
            <Plus size={14} />
            <span>New Opportunity</span>
          </button>
        </div>
      </div>
    </div>
  );
};
