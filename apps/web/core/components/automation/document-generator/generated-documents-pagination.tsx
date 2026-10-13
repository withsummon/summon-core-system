/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@plane/utils";

type Props = {
  currentPage: number;
  totalPages: number;
  totalCount: number;
  pageSize: number;
  onPageChange: (page: number | ((page: number) => number)) => void;
};

function PageNumberButton({
  page,
  isCurrent,
  onSelect,
}: {
  page: number;
  isCurrent: boolean;
  onSelect: (page: number) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(page)}
      className={cn(
        "flex size-7 items-center justify-center rounded-md text-xs font-semibold transition-colors",
        isCurrent
          ? "bg-accent-primary text-on-color shadow-xs"
          : "border border-subtle bg-surface-1 text-primary hover:bg-surface-2"
      )}
    >
      {page}
    </button>
  );
}

export function GeneratedDocumentsPagination({ currentPage, totalPages, totalCount, pageSize, onPageChange }: Props) {
  return (
    <div className="mt-4 flex items-center justify-between border-t border-subtle pt-3 text-xs text-secondary">
      <div className="tabular-nums">
        Showing {Math.min(1, totalCount)} to {Math.min(pageSize, totalCount)} of {totalCount} documents
      </div>

      <div className="flex items-center gap-1">
        <button
          type="button"
          disabled={currentPage === 1}
          onClick={() => onPageChange((p) => Math.max(1, p - 1))}
          aria-label="Previous page"
          className="flex size-7 items-center justify-center rounded-md border border-subtle bg-surface-1 text-placeholder transition-colors hover:border-strong hover:text-primary disabled:opacity-40"
        >
          <ChevronLeft size={13} />
        </button>

        <PageNumberButton page={1} isCurrent={currentPage === 1} onSelect={onPageChange} />
        {totalPages >= 2 && <PageNumberButton page={2} isCurrent={currentPage === 2} onSelect={onPageChange} />}
        {totalPages >= 3 && <PageNumberButton page={3} isCurrent={currentPage === 3} onSelect={onPageChange} />}
        {totalPages > 4 && <span className="px-1 text-placeholder">…</span>}
        {totalPages > 3 && (
          <PageNumberButton page={totalPages} isCurrent={currentPage === totalPages} onSelect={onPageChange} />
        )}

        <button
          type="button"
          disabled={currentPage === totalPages}
          onClick={() => onPageChange((p) => Math.min(totalPages, p + 1))}
          aria-label="Next page"
          className="flex size-7 items-center justify-center rounded-md border border-subtle bg-surface-1 text-placeholder transition-colors hover:border-strong hover:text-primary disabled:opacity-40"
        >
          <ChevronRight size={13} />
        </button>
      </div>
    </div>
  );
}
