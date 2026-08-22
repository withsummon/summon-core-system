/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import React from "react";
import { FileText, ArrowRight } from "lucide-react";
import { cn } from "@plane/utils";
import { RECENT_NOTES } from "./mock-data";
import type { IRecentNote } from "./types";

interface IRecentNotesCardProps {
  notes?: IRecentNote[];
  onSelectNote?: (note: IRecentNote) => void;
  onViewAllNotes?: () => void;
}

const getNoteIconColor = (color: string) => {
  switch (color) {
    case "yellow":
      return "text-amber-500";
    case "green":
      return "text-emerald-500";
    case "blue":
      return "text-blue-500";
    case "gray":
      return "text-slate-400";
    case "orange":
    default:
      return "text-orange-500";
  }
};

export const RecentNotesCard: React.FC<IRecentNotesCardProps> = ({
  notes = RECENT_NOTES,
  onSelectNote,
  onViewAllNotes,
}) => {
  return (
    <div className="flex flex-col rounded-xl border border-subtle bg-surface-1 p-4 shadow-xs">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xs font-semibold text-primary">Recent Notes</h2>
        <button
          type="button"
          onClick={onViewAllNotes}
          className="flex items-center gap-1 text-[11px] font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
        >
          <span>View all</span>
          <ArrowRight size={12} />
        </button>
      </div>

      {/* List */}
      <div className="space-y-2.5">
        {notes.map((note) => (
          <div
            key={note.id}
            onClick={() => onSelectNote?.(note)}
            className="group flex items-start gap-2.5 rounded-lg p-1.5 hover:bg-surface-2 transition-colors cursor-pointer"
          >
            <FileText
              size={15}
              className={cn("mt-0.5 shrink-0", getNoteIconColor(note.iconColor))}
            />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-primary group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors truncate">
                {note.title}
              </p>
              <p className="text-[10px] text-secondary mt-0.5">{note.timeAgo}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
