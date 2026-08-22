/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { Button } from "@plane/ui";

export function SummonRequestState(props: {
  loading?: boolean;
  error?: unknown;
  empty?: boolean;
  emptyMessage?: string;
  validationError?: string;
  permissionError?: boolean;
  permissionMessage?: string;
  onRetry?: () => void;
}) {
  const {
    loading,
    error,
    empty,
    emptyMessage = "No records yet.",
    validationError,
    permissionError,
    permissionMessage = "You do not have permission to view this module.",
    onRetry,
  } = props;
  if (loading)
    return (
      <div
        className="text-sm rounded-xl border border-subtle bg-surface-1 p-6 text-center text-secondary"
        role="status"
      >
        Loading Summon data…
      </div>
    );
  if (validationError)
    return (
      <div
        className="text-sm rounded-xl border border-danger-subtle bg-danger-subtle/20 p-4 text-danger-primary"
        role="alert"
      >
        {validationError}
      </div>
    );
  if (permissionError)
    return (
      <div
        className="text-sm rounded-xl border border-warning-subtle bg-warning-subtle/20 p-4 text-warning-primary"
        role="alert"
      >
        {permissionMessage}
      </div>
    );
  if (error)
    return (
      <div
        className="text-sm rounded-xl border border-danger-subtle bg-danger-subtle/20 p-4 text-danger-primary"
        role="alert"
      >
        <p>Could not load this module. Check your access or try again.</p>
        {onRetry ? (
          <Button className="mt-3" variant="neutral-primary" size="sm" onClick={onRetry}>
            Retry
          </Button>
        ) : null}
      </div>
    );
  if (empty)
    return (
      <div className="text-sm rounded-xl border border-dashed border-subtle bg-surface-1 p-8 text-center text-secondary">
        {emptyMessage}
      </div>
    );
  return null;
}
