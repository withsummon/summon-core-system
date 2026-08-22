/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import React from "react";
import { Search, Bell, FileText } from "lucide-react";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";

interface IKnowledgeHeaderProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onOpenQuickFind?: () => void;
}

export const KnowledgeHeader: React.FC<IKnowledgeHeaderProps> = ({
  searchQuery,
  onSearchChange,
  onOpenQuickFind,
}) => {
  const handleBellClick = () => {
    setToast({
      type: TOAST_TYPE.INFO,
      title: "Notifications",
      message: "You have 1 new knowledge update notification.",
    });
  };

  const handleNotesClick = () => {
    setToast({
      type: TOAST_TYPE.INFO,
      title: "Quick Notes",
      message: "Opening quick notes drawer.",
    });
  };

  return (
    <div className="w-full space-y-4">
      {/* Top bar with title and action icons */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-primary">Knowledge</h1>
          <p className="text-xs text-secondary mt-0.5">
            Your company knowledge, notes and insights in one place
          </p>
        </div>

        {/* Right header icons */}
        <div className="flex items-center gap-2.5">
          {/* Notifications */}
          <button
            type="button"
            onClick={handleBellClick}
            className="relative flex size-9 items-center justify-center rounded-full border border-subtle bg-surface-1 text-secondary hover:border-strong hover:text-primary transition-colors shadow-xs"
          >
            <Bell size={16} />
            <span className="absolute -top-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white ring-2 ring-surface-1">
              1
            </span>
          </button>

          {/* Quick Notes Icon */}
          <button
            type="button"
            onClick={handleNotesClick}
            className="flex size-9 items-center justify-center rounded-full border border-subtle bg-surface-1 text-secondary hover:border-strong hover:text-primary transition-colors shadow-xs"
          >
            <FileText size={16} />
          </button>

          {/* Avatar Profile */}
          <div className="flex size-9 items-center justify-center rounded-full border border-subtle bg-surface-2 text-xs font-semibold text-primary overflow-hidden ring-1 ring-subtle shadow-xs cursor-pointer">
            <img
              src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80"
              alt="Profile"
              className="size-full object-cover"
            />
          </div>
        </div>
      </div>

      {/* Global Search Bar */}
      <div className="relative w-full">
        <div className="flex items-center rounded-xl border border-subtle bg-surface-1 px-4 py-2.5 shadow-xs focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20 transition-all">
          <Search size={17} className="text-placeholder mr-3 shrink-0" />
          <input
            type="text"
            placeholder="Search knowledge, notes, topics, or ask anything..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full bg-transparent text-xs text-primary placeholder:text-placeholder focus:outline-none"
          />
          <button
            type="button"
            onClick={onOpenQuickFind}
            className="ml-2 hidden sm:flex items-center gap-1 rounded-md border border-subtle bg-surface-2/80 px-2 py-0.5 text-[10px] font-medium text-secondary hover:bg-surface-3 transition-colors"
          >
            <span>⌘</span>
            <span>K</span>
          </button>
        </div>
      </div>
    </div>
  );
};
