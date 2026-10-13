/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import React from "react";
import { Search, Bell, FileText } from "lucide-react";
import { observer } from "mobx-react";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import { Avatar } from "@plane/ui";
import { getFileURL } from "@plane/utils";
import { useUser } from "@/hooks/store/user";

interface IKnowledgeHeaderProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onOpenQuickFind?: () => void;
}

export const KnowledgeHeader = observer(function KnowledgeHeader({
  searchQuery,
  onSearchChange,
  onOpenQuickFind,
}: IKnowledgeHeaderProps) {
  const { data: currentUser } = useUser();

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
          <p className="mt-0.5 text-xs text-secondary">Your company knowledge, notes and insights in one place</p>
        </div>

        {/* Right header icons */}
        <div className="flex items-center gap-2.5">
          {/* Notifications */}
          <button
            type="button"
            aria-label="Notifications"
            onClick={handleBellClick}
            className="relative flex size-9 items-center justify-center rounded-full border border-subtle bg-surface-1 text-secondary shadow-xs transition-colors hover:border-strong hover:text-primary"
          >
            <Bell size={16} />
            <span className="absolute -top-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full bg-danger-primary text-[9px] font-bold text-on-color ring-2 ring-(--background-color-surface-1)">
              1
            </span>
          </button>

          {/* Quick Notes Icon */}
          <button
            type="button"
            aria-label="Quick notes"
            onClick={handleNotesClick}
            className="flex size-9 items-center justify-center rounded-full border border-subtle bg-surface-1 text-secondary shadow-xs transition-colors hover:border-strong hover:text-primary"
          >
            <FileText size={16} />
          </button>

          {/* Avatar Profile */}
          <Avatar
            name={currentUser?.display_name}
            src={getFileURL(currentUser?.avatar_url ?? "")}
            size={36}
            shape="circle"
          />
        </div>
      </div>

      {/* Global Search Bar */}
      <div className="relative w-full">
        <div className="flex items-center rounded-xl border border-subtle bg-surface-1 px-4 py-2.5 shadow-xs transition-[border-color,box-shadow] focus-within:border-accent-strong focus-within:ring-2 focus-within:ring-accent-subtle">
          <Search size={17} className="mr-3 shrink-0 text-placeholder" />
          <input
            type="text"
            placeholder="Search knowledge, notes, topics, or ask anything…"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full bg-transparent text-xs text-primary outline-none placeholder:text-placeholder"
          />
          <button
            type="button"
            onClick={onOpenQuickFind}
            className="hover:bg-surface-3 ml-2 hidden items-center gap-1 rounded-md border border-subtle bg-surface-2/80 px-2 py-0.5 text-[10px] font-medium text-secondary transition-colors sm:flex"
          >
            <span>⌘</span>
            <span>K</span>
          </button>
        </div>
      </div>
    </div>
  );
});
