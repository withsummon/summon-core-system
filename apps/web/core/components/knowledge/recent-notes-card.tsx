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
      return "text-label-yellow-icon";
    case "green":
      return "text-label-emerald-icon";
    case "blue":
      return "text-label-indigo-icon";
    case "gray":
      return "text-label-grey-icon";
    case "orange":
    default:
      return "text-label-orange-icon";
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
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-xs font-semibold text-primary">Recent Notes</h2>
        <button
          type="button"
          onClick={onViewAllNotes}
          className="flex items-center gap-1 text-[11px] font-medium text-link-primary transition-colors hover:text-link-primary-hover"
        >
          <span>View all</span>
          <ArrowRight size={12} />
        </button>
      </div>

      {/* List */}
      <div className="space-y-2.5">
        {notes.map((note) => (
          <button
            type="button"
            key={note.id}
            onClick={() => onSelectNote?.(note)}
            className="group flex w-full cursor-pointer items-start gap-2.5 rounded-lg p-1.5 text-left transition-colors hover:bg-surface-2"
          >
            <FileText size={15} className={cn("mt-0.5 shrink-0", getNoteIconColor(note.iconColor))} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-primary transition-colors group-hover:text-accent-primary">
                {note.title}
              </p>
              <p className="mt-0.5 text-[10px] text-secondary">{note.timeAgo}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};
