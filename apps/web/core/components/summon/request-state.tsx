/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { ReactNode } from "react";
import { Inbox } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@plane/propel/button";

export function SummonRequestState(props: {
  loading?: boolean;
  error?: unknown;
  empty?: boolean;
  emptyMessage?: string;
  emptyTitle?: string;
  emptyIcon?: LucideIcon;
  emptyAction?: ReactNode;
  validationError?: string;
  permissionError?: boolean;
  permissionMessage?: string;
  onRetry?: () => void;
}) {
  const {
    loading,
    error,
    empty,
    emptyMessage = "Nothing here yet.",
    emptyTitle,
    emptyIcon: EmptyIcon = Inbox,
    emptyAction,
    validationError,
    permissionError,
    permissionMessage = "You do not have permission to view this module.",
    onRetry,
  } = props;
  if (loading)
    return (
      <div className="grid place-items-center rounded-xl px-6 py-10 text-13 text-tertiary" role="status">
        Loading…
      </div>
    );
  if (validationError)
    return (
      <div
        className="rounded-xl border border-danger-subtle bg-danger-subtle/20 p-4 text-sm text-danger-primary"
        role="alert"
      >
        {validationError}
      </div>
    );
  if (permissionError)
    return (
      <div
        className="rounded-xl border border-warning-subtle bg-warning-subtle/20 p-4 text-sm text-warning-primary"
        role="alert"
      >
        {permissionMessage}
      </div>
    );
  if (error)
    return (
      <div
        className="rounded-xl border border-danger-subtle bg-danger-subtle/20 p-4 text-sm text-danger-primary"
        role="alert"
      >
        <p>Could not load this module. Check your access or try again.</p>
        {onRetry ? (
          <Button className="mt-3" variant="secondary" size="lg" onClick={onRetry}>
            Retry
          </Button>
        ) : null}
      </div>
    );
  if (empty)
    return (
      <div className="flex flex-col items-center rounded-xl bg-dot-grid px-6 py-10 text-center">
        <span className="grid size-8 place-items-center rounded-lg bg-surface-1 text-tertiary shadow-raised-100 ring ring-subtle">
          <EmptyIcon aria-hidden className="size-4" />
        </span>
        {emptyTitle ? <p className="mt-3 text-14 font-medium text-primary">{emptyTitle}</p> : null}
        <p className={`${emptyTitle ? "mt-1" : "mt-3"} max-w-sm text-13 text-tertiary`}>{emptyMessage}</p>
        {emptyAction ? <div className="mt-4">{emptyAction}</div> : null}
      </div>
    );
  return null;
}
