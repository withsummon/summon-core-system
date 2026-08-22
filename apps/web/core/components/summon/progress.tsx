/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

export function SummonProgressRing({ value, label }: { value: number; label: string }) {
  const safeValue = Math.min(100, Math.max(0, value));
  return (
    <div
      className="grid size-20 place-items-center rounded-full"
      style={{ background: `conic-gradient(var(--color-accent-primary) ${safeValue}%, var(--color-layer-2) 0)` }}
      role="progressbar"
      aria-label={`${label}: ${safeValue}%`}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={safeValue}
    >
      <span className="text-sm grid size-16 place-items-center rounded-full bg-surface-1 font-semibold text-primary">
        {safeValue}%
      </span>
    </div>
  );
}

export function SummonProgressBar({ value, label }: { value: number; label: string }) {
  const safeValue = Math.min(100, Math.max(0, value));
  return (
    <div
      className="h-2 overflow-hidden rounded-full bg-layer-2"
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={safeValue}
    >
      <div className="h-full rounded-full bg-accent-primary" style={{ width: `${safeValue}%` }} />
    </div>
  );
}
