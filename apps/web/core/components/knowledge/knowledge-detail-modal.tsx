/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import React, { useState } from "react";
import { X, Copy, Check, Share2, Download, FileText, Tag } from "lucide-react";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import type { IKnowledgeItem } from "./types";

interface IKnowledgeDetailModalProps {
  item: IKnowledgeItem | null;
  isOpen: boolean;
  onClose: () => void;
}

export const KnowledgeDetailModal: React.FC<IKnowledgeDetailModalProps> = ({
  item,
  isOpen,
  onClose,
}) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen || !item) return null;

  const handleCopy = () => {
    if (item.content) {
      navigator.clipboard.writeText(item.content);
      setCopied(true);
      setToast({
        type: TOAST_TYPE.SUCCESS,
        title: "Copied to clipboard",
        message: "Content copied successfully.",
      });
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDownload = () => {
    setToast({
      type: TOAST_TYPE.SUCCESS,
      title: "Downloading Document",
      message: `Downloading ${item.title}.md`,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div
        className="relative flex h-[85vh] w-full max-w-4xl flex-col rounded-2xl border border-subtle bg-surface-1 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-subtle px-6 py-4 bg-surface-2/60">
          <div className="flex items-center gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-blue-200 bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:border-blue-800">
              <FileText size={18} />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-primary">{item.title}</h3>
              <p className="text-xs text-secondary">{item.context} • Updated {item.updatedAt}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopy}
              className="flex items-center gap-1.5 rounded-lg border border-subtle bg-surface-1 px-3 py-1.5 text-xs font-medium text-secondary hover:bg-surface-2 hover:text-primary transition-colors"
            >
              {copied ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
              <span>{copied ? "Copied" : "Copy"}</span>
            </button>
            <button
              type="button"
              onClick={handleDownload}
              className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 transition-colors shadow-xs"
            >
              <Download size={14} />
              <span>Export</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-placeholder hover:bg-surface-2 hover:text-primary transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-8 bg-surface-1">
          <div className="mx-auto max-w-3xl space-y-6 text-sm text-primary">
            {item.tags && item.tags.length > 0 && (
              <div className="flex items-center gap-1.5">
                <Tag size={13} className="text-placeholder" />
                {item.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full bg-layer-2 px-2.5 py-0.5 text-[10px] font-medium text-secondary"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            )}

            {item.content ? (
              <div className="space-y-4">
                {item.content.split("\n\n").map((paragraph, idx) => {
                  if (paragraph.startsWith("# ")) {
                    return (
                      <h1 key={idx} className="text-2xl font-bold text-primary border-b border-subtle pb-2">
                        {paragraph.replace("# ", "")}
                      </h1>
                    );
                  }
                  if (paragraph.startsWith("## ")) {
                    return (
                      <h2 key={idx} className="text-lg font-semibold text-primary mt-4">
                        {paragraph.replace("## ", "")}
                      </h2>
                    );
                  }
                  if (paragraph.startsWith("### ")) {
                    return (
                      <h3 key={idx} className="text-sm font-semibold text-primary mt-3">
                        {paragraph.replace("### ", "")}
                      </h3>
                    );
                  }
                  if (paragraph.startsWith("- ")) {
                    const lines = paragraph.split("\n");
                    return (
                      <ul key={idx} className="list-disc pl-5 space-y-1 text-secondary">
                        {lines.map((l, i) => (
                          <li key={i}>{l.replace(/^-\s*/, "")}</li>
                        ))}
                      </ul>
                    );
                  }
                  if (paragraph.startsWith("1. ")) {
                    const lines = paragraph.split("\n");
                    return (
                      <ol key={idx} className="list-decimal pl-5 space-y-1 text-secondary">
                        {lines.map((l, i) => (
                          <li key={i}>{l.replace(/^\d+\.\s*/, "")}</li>
                        ))}
                      </ol>
                    );
                  }
                  return (
                    <p key={idx} className="leading-relaxed text-secondary">
                      {paragraph}
                    </p>
                  );
                })}
              </div>
            ) : (
              <p className="text-secondary">{item.description}</p>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between border-t border-subtle px-6 py-3 bg-surface-2/40 text-xs text-secondary">
          <div className="flex items-center gap-2">
            <span>Author: <strong className="text-primary">{item.updatedBy.name}</strong></span>
            <span>•</span>
            <span>Type: <strong className="text-primary">{item.type}</strong></span>
          </div>
          <div>
            <span>Summon Knowledge Engine</span>
          </div>
        </div>
      </div>
    </div>
  );
};
