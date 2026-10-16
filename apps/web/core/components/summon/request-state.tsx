/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { ReactNode } from "react";
import { Button } from "@plane/propel/button";
import { EmptyStateDetailed } from "@plane/propel/empty-state";
import type { DetailedAssetType } from "@plane/propel/empty-state";
import { SummonSkeletonBlock, SummonSkeletonRows } from "@/components/summon/skeleton";

export function SummonRequestState(props: {
  loading?: boolean;
  /** Shown while `loading`: a skeleton shaped like the content it precedes, so nothing moves when it arrives. */
  skeleton?: ReactNode;
  error?: unknown;
  empty?: boolean;
  emptyMessage?: string;
  emptyTitle?: string;
  emptyAsset?: DetailedAssetType;
  emptyAction?: ReactNode;
  validationError?: string;
  permissionError?: boolean;
  permissionMessage?: string;
  onRetry?: () => void;
}) {
  const {
    loading,
    skeleton,
    error,
    empty,
    emptyMessage = "Nothing here yet.",
    emptyTitle,
    emptyAsset,
    emptyAction,
    validationError,
    permissionError,
    permissionMessage = "You do not have permission to view this module.",
    onRetry,
  } = props;
  if (loading)
    return (
      skeleton ?? (
        <SummonSkeletonRows
          count={4}
          className="flex flex-col gap-2"
          row={(index) => <SummonSkeletonBlock key={index} className="h-10 w-full rounded-lg" />}
        />
      )
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
        role="status"
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
      <EmptyStateDetailed
        align="center"
        assetKey={emptyAsset}
        assetClassName="h-auto w-32"
        title={emptyTitle}
        description={emptyMessage}
        customButton={emptyAction}
        rootClassName={emptyAsset ? "px-6 py-12" : "px-4 py-6"}
      />
    );
  return null;
}
