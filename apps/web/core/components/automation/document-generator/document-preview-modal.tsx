/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import React from "react";
import { X, Download, Copy, Check, FileText } from "lucide-react";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import { TypeIcon } from "./type-icon";
import type { IGeneratedDocument } from "./types";

interface IDocumentPreviewModalProps {
  document: IGeneratedDocument | null;
  isOpen: boolean;
  onClose: () => void;
}

export const DocumentPreviewModal: React.FC<IDocumentPreviewModalProps> = ({
  document,
  isOpen,
  onClose,
}) => {
  const [isCopied, setIsCopied] = React.useState(false);

  if (!isOpen || !document) return null;

  const handleCopy = () => {
    if (document.content) {
      navigator.clipboard.writeText(document.content);
      setIsCopied(true);
      setToast({
        type: TOAST_TYPE.SUCCESS,
        title: "Copied to clipboard",
        message: "Document content has been copied to your clipboard.",
      });
      setTimeout(() => setIsCopied(false), 2000);
    }
  };

  const handleDownload = () => {
    setToast({
      type: TOAST_TYPE.SUCCESS,
      title: "Downloading...",
      message: `Preparing ${document.format || "DOCX"} file for download.`,
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
            <TypeIcon type={document.type} boxed size={20} />
            <div>
              <h3 className="text-sm font-semibold text-primary">{document.title}</h3>
              <p className="text-xs text-secondary">{document.context} • {document.createdAt}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopy}
              className="flex items-center gap-1.5 rounded-lg border border-subtle bg-surface-1 px-3 py-1.5 text-xs font-medium text-secondary hover:bg-surface-2 hover:text-primary transition-colors"
            >
              {isCopied ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
              <span>{isCopied ? "Copied" : "Copy"}</span>
            </button>
            <button
              type="button"
              onClick={handleDownload}
              className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 transition-colors shadow-xs"
            >
              <Download size={14} />
              <span>Download {document.format || "DOCX"}</span>
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

        {/* Modal Body / Markdown Document Content */}
        <div className="flex-1 overflow-y-auto p-8 bg-surface-1">
          <div className="mx-auto max-w-3xl space-y-6 text-sm text-primary">
            {document.content ? (
              <div className="prose prose-sm dark:prose-invert max-w-none space-y-4">
                {document.content.split("\n\n").map((paragraph, idx) => {
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
                    const items = paragraph.split("\n");
                    return (
                      <ul key={idx} className="list-disc pl-5 space-y-1 text-secondary">
                        {items.map((item, i) => (
                          <li key={i}>{item.replace(/^-\s*/, "")}</li>
                        ))}
                      </ul>
                    );
                  }
                  if (paragraph.startsWith("1. ")) {
                    const items = paragraph.split("\n");
                    return (
                      <ol key={idx} className="list-decimal pl-5 space-y-1 text-secondary">
                        {items.map((item, i) => (
                          <li key={i}>{item.replace(/^\d+\.\s*/, "")}</li>
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
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <FileText size={48} className="text-placeholder mb-3" />
                <p className="text-sm font-medium text-primary">{document.title}</p>
                <p className="text-xs text-secondary mt-1">{document.description}</p>
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between border-t border-subtle px-6 py-3 bg-surface-2/40 text-xs text-secondary">
          <div className="flex items-center gap-2">
            <span>Author: <strong className="text-primary">{document.createdBy.name}</strong></span>
            <span>•</span>
            <span>Status: <strong className="text-emerald-600">{document.status}</strong></span>
          </div>
          <div>
            <span>Summon AI Document System</span>
          </div>
        </div>
      </div>
    </div>
  );
};
