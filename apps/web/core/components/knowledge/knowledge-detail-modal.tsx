/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import React, { useState } from "react";
import { X, Copy, Check, Download, FileText, Tag } from "lucide-react";
import { Dialog, EDialogWidth } from "@plane/propel/dialog";
import { Button } from "@plane/propel/button";
import { IconButton } from "@plane/propel/icon-button";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import type { IKnowledgeItem } from "./types";

interface IKnowledgeDetailModalProps {
  item: IKnowledgeItem | null;
  isOpen: boolean;
  onClose: () => void;
}

export const KnowledgeDetailModal: React.FC<IKnowledgeDetailModalProps> = ({ item, isOpen, onClose }) => {
  const [copied, setCopied] = useState(false);

  if (!item) return null;

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
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Panel width={EDialogWidth.XXXXL} className="flex h-[85vh] flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-subtle bg-surface-2/60 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="border-blue-200 bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:border-blue-800 flex size-9 shrink-0 items-center justify-center rounded-lg border">
              <FileText size={18} />
            </div>
            <div>
              <Dialog.Title className="text-14 font-semibold text-primary">{item.title}</Dialog.Title>
              <p className="text-xs text-secondary">
                {item.context} • Updated {item.updatedAt}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={handleCopy}>
              {copied ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
              <span>{copied ? "Copied" : "Copy"}</span>
            </Button>
            <Button onClick={handleDownload}>
              <Download size={14} />
              <span>Export</span>
            </Button>
            <IconButton variant="ghost" icon={X} aria-label="Close preview" onClick={onClose} />
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto bg-surface-1 p-8">
          <div className="text-sm mx-auto max-w-3xl space-y-6 text-primary">
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
                      <h1 key={idx} className="text-2xl border-b border-subtle pb-2 font-bold text-primary">
                        {paragraph.replace("# ", "")}
                      </h1>
                    );
                  }
                  if (paragraph.startsWith("## ")) {
                    return (
                      <h2 key={idx} className="text-lg mt-4 font-semibold text-primary">
                        {paragraph.replace("## ", "")}
                      </h2>
                    );
                  }
                  if (paragraph.startsWith("### ")) {
                    return (
                      <h3 key={idx} className="text-sm mt-3 font-semibold text-primary">
                        {paragraph.replace("### ", "")}
                      </h3>
                    );
                  }
                  if (paragraph.startsWith("- ")) {
                    const lines = paragraph.split("\n");
                    return (
                      <ul key={idx} className="list-disc space-y-1 pl-5 text-secondary">
                        {lines.map((l, i) => (
                          <li key={i}>{l.replace(/^-\s*/, "")}</li>
                        ))}
                      </ul>
                    );
                  }
                  if (paragraph.startsWith("1. ")) {
                    const lines = paragraph.split("\n");
                    return (
                      <ol key={idx} className="list-decimal space-y-1 pl-5 text-secondary">
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
        <div className="text-xs flex items-center justify-between border-t border-subtle bg-surface-2/40 px-6 py-3 text-secondary">
          <div className="flex items-center gap-2">
            <span>
              Author: <strong className="text-primary">{item.updatedBy.name}</strong>
            </span>
            <span>•</span>
            <span>
              Type: <strong className="text-primary">{item.type}</strong>
            </span>
          </div>
          <div>
            <span>Summon Knowledge Engine</span>
          </div>
        </div>
      </Dialog.Panel>
    </Dialog>
  );
};
