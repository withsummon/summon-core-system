/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { Eye, MoreHorizontal, Check, Download, Trash2 } from "lucide-react";
import { cn } from "@plane/utils";
import { TypeIcon, getDocumentTypeTheme } from "./type-icon";
import type { IGeneratedDocument } from "./types";

type Props = {
  doc: IGeneratedDocument;
  isMenuOpen: boolean;
  onToggleMenu: () => void;
  onCloseMenu: () => void;
  onPreviewDocument: (doc: IGeneratedDocument) => void;
  onDownload: (doc: IGeneratedDocument) => void;
  onDelete: (doc: IGeneratedDocument) => void;
};

export function GeneratedDocumentRow({
  doc,
  isMenuOpen,
  onToggleMenu,
  onCloseMenu,
  onPreviewDocument,
  onDownload,
  onDelete,
}: Props) {
  const theme = getDocumentTypeTheme(doc.type);

  const handlePreviewFromMenu = () => {
    onCloseMenu();
    onPreviewDocument(doc);
  };

  return (
    <tr className="group transition-colors hover:bg-surface-2/60">
      {/* Document Info */}
      <td className="py-3 pr-3 pl-1">
        <div className="flex items-start gap-2.5">
          <TypeIcon type={doc.type} size={16} className="mt-0.5 shrink-0" />
          <div className="max-w-[200px] xl:max-w-[240px]">
            <button
              type="button"
              onClick={() => onPreviewDocument(doc)}
              title={doc.title}
              className="block w-full cursor-pointer truncate text-left font-semibold text-primary transition-colors group-hover:text-accent-primary focus-visible:outline-2 focus-visible:outline-accent-strong focus-visible:outline-solid"
            >
              {doc.title}
            </button>
            <p className="mt-0.5 truncate text-[11px] text-secondary" title={doc.description}>
              {doc.description}
            </p>
          </div>
        </div>
      </td>

      {/* Type Badge */}
      <td className="py-3 pr-3 whitespace-nowrap">
        <span className={cn("inline-block rounded-full px-2.5 py-0.5 text-[10px] font-medium", theme.badgeBg)}>
          {doc.type}
        </span>
      </td>

      {/* Context */}
      <td className="py-3 pr-3 text-[11px] whitespace-nowrap text-secondary">{doc.context}</td>

      {/* Created By */}
      <td className="py-3 pr-3 whitespace-nowrap">
        <div className="flex items-center gap-2">
          {doc.createdBy.avatar ? (
            <img
              src={doc.createdBy.avatar}
              alt={doc.createdBy.name}
              className="size-5.5 rounded-full object-cover ring-1 ring-subtle"
            />
          ) : (
            <div className="flex size-5.5 items-center justify-center rounded-full bg-label-indigo-bg-strong text-[9px] font-bold text-on-color">
              {doc.createdBy.initials}
            </div>
          )}
          <span className="text-[11px] font-medium text-primary">{doc.createdBy.name}</span>
        </div>
      </td>

      {/* Created At */}
      <td className="py-3 pr-3 text-[11px] whitespace-nowrap text-secondary tabular-nums">{doc.createdAt}</td>

      {/* Status */}
      <td className="py-3 pr-3 whitespace-nowrap">
        {doc.status === "Completed" ? (
          <span className="inline-flex items-center gap-1 rounded-full border border-success-subtle bg-success-subtle px-2 py-0.5 text-[10px] font-medium text-success-primary">
            <Check size={11} strokeWidth={2.5} />
            <span>Completed</span>
          </span>
        ) : (
          <span className="inline-flex items-center rounded-full border border-accent-subtle bg-accent-subtle px-2.5 py-0.5 text-[10px] font-medium text-accent-primary">
            Draft
          </span>
        )}
      </td>

      {/* Actions */}
      <td className="py-3 pr-2 text-right whitespace-nowrap">
        <div className="relative inline-flex items-center gap-1">
          <button
            type="button"
            onClick={() => onPreviewDocument(doc)}
            title="Preview document"
            aria-label="Preview document"
            className="rounded-md p-1.5 text-placeholder transition-colors hover:bg-layer-1-hover hover:text-primary"
          >
            <Eye size={14} />
          </button>

          <button
            type="button"
            onClick={onToggleMenu}
            title="More options"
            aria-label="More options"
            className="rounded-md p-1.5 text-placeholder transition-colors hover:bg-layer-1-hover hover:text-primary"
          >
            <MoreHorizontal size={14} />
          </button>

          {/* Action Dropdown Menu */}
          {isMenuOpen && (
            <div
              className="absolute top-full right-0 z-40 mt-1 w-36 rounded-lg border border-subtle bg-surface-1 py-1 text-left shadow-lg"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={handlePreviewFromMenu}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-[11px] text-primary transition-colors hover:bg-surface-2"
              >
                <Eye size={12} />
                <span>View Preview</span>
              </button>
              <button
                type="button"
                onClick={() => onDownload(doc)}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-[11px] text-primary transition-colors hover:bg-surface-2"
              >
                <Download size={12} />
                <span>Download</span>
              </button>
              <div className="my-1 border-t border-subtle" />
              <button
                type="button"
                onClick={() => onDelete(doc)}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-[11px] text-danger-primary transition-colors hover:bg-danger-subtle"
              >
                <Trash2 size={12} />
                <span>Delete</span>
              </button>
            </div>
          )}
        </div>
      </td>
    </tr>
  );
}
