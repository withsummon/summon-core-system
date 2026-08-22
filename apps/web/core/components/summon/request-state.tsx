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
  onRetry?: () => void;
}) {
  const { loading, error, empty, emptyMessage = "No records yet.", onRetry } = props;
  if (loading) return <div className="text-sm p-6 text-secondary">Loading Summon data…</div>;
  if (error)
    return (
      <div className="text-sm m-6 rounded-lg border border-danger-subtle bg-danger-subtle/20 p-4 text-danger-primary">
        <p>Could not load this module. Check your access or try again.</p>
        {onRetry ? (
          <Button className="mt-3" variant="neutral-primary" size="sm" onClick={onRetry}>
            Retry
          </Button>
        ) : null}
      </div>
    );
  if (empty) return <div className="text-sm p-6 text-secondary">{emptyMessage}</div>;
  return null;
}
