/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import React from "react";
import { FilePlus, Upload, Globe, Sparkles, ChevronRight } from "lucide-react";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";

interface IQuickActionsCardProps {
  onCreateNote?: () => void;
  onUploadDocument?: () => void;
  onCreateFromUrl?: () => void;
  onAskAssistant?: () => void;
}

export const QuickActionsCard: React.FC<IQuickActionsCardProps> = ({
  onCreateNote,
  onUploadDocument,
  onCreateFromUrl,
  onAskAssistant,
}) => {
  const actions = [
    {
      id: "create-note",
      label: "Create New Note",
      icon: FilePlus,
      onClick: () => {
        if (onCreateNote) onCreateNote();
        else {
          setToast({
            type: TOAST_TYPE.INFO,
            title: "New Note",
            message: "Opening new note editor.",
          });
        }
      },
    },
    {
      id: "upload-doc",
      label: "Upload Document",
      icon: Upload,
      onClick: () => {
        if (onUploadDocument) onUploadDocument();
        else {
          setToast({
            type: TOAST_TYPE.INFO,
            title: "Upload Document",
            message: "Select PDF, DOCX, or Markdown files to ingest.",
          });
        }
      },
    },
    {
      id: "create-url",
      label: "Create Knowledge from URL",
      icon: Globe,
      onClick: () => {
        if (onCreateFromUrl) onCreateFromUrl();
        else {
          setToast({
            type: TOAST_TYPE.INFO,
            title: "Ingest URL",
            message: "Enter webpage URL to extract knowledge automatically.",
          });
        }
      },
    },
    {
      id: "ask-assistant",
      label: "Ask Summon Assistant",
      icon: Sparkles,
      onClick: () => {
        if (onAskAssistant) onAskAssistant();
        else {
          const el = document.querySelector("input[placeholder*='Ask a question']");
          if (el instanceof HTMLInputElement) el.focus();
        }
      },
    },
  ];

  return (
    <div className="flex flex-col rounded-xl border border-subtle bg-surface-1 p-4 shadow-xs">
      <h2 className="text-xs font-semibold text-primary mb-3">Quick Actions</h2>
      <div className="space-y-1">
        {actions.map((action) => {
          const IconComp = action.icon;
          return (
            <button
              key={action.id}
              type="button"
              onClick={action.onClick}
              className="group flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-xs font-medium text-primary hover:bg-surface-2 transition-colors text-left"
            >
              <div className="flex items-center gap-2.5">
                <div className="flex size-6 shrink-0 items-center justify-center rounded-md text-blue-600 dark:text-blue-400">
                  <IconComp size={15} />
                </div>
                <span className="text-xs font-medium text-primary group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                  {action.label}
                </span>
              </div>
              <ChevronRight
                size={14}
                className="text-placeholder transition-transform group-hover:translate-x-0.5 group-hover:text-primary"
              />
            </button>
          );
        })}
      </div>
    </div>
  );
};
