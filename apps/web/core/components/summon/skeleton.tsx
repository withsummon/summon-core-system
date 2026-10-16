/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { ReactNode } from "react";
import { Skeleton } from "@plane/propel/skeleton";
import { cn } from "@plane/utils";

/**
 * Placeholder for data that is still loading. Skeletons copy the markup of what they stand in for, so the page
 * keeps its layout when the data arrives: render the real containers and static text, and put skeletons only where
 * values go.
 */
export function SummonSkeleton(props: { children: ReactNode; className?: string; label?: string }) {
  return (
    <Skeleton className={props.className} ariaLabel={props.label ?? "Loading"}>
      {props.children}
    </Skeleton>
  );
}

/**
 * One line of placeholder text. Give it the text classes of the line it replaces (`text-13 font-medium`, `mt-1`…):
 * the bar holds a non-breaking space in that font, so its height is exactly that line's height.
 */
export function SummonSkeletonText(props: { className?: string; width?: string }) {
  return (
    <span aria-hidden className={cn("block", props.className)}>
      <span className={cn("inline-block max-w-full rounded-sm bg-layer-1", props.width ?? "w-24")}>&nbsp;</span>
    </span>
  );
}

/** A fixed-size placeholder shape (an avatar, a badge, a chart). */
export function SummonSkeletonBlock(props: { className: string }) {
  return <span aria-hidden className={cn("block rounded-md bg-layer-1", props.className)} />;
}

/** `count` copies of `row`, for lists whose rows have a known shape. */
export function SummonSkeletonRows(props: {
  count: number;
  row: (index: number) => ReactNode;
  className?: string;
  label?: string;
}) {
  return (
    <SummonSkeleton className={props.className} label={props.label}>
      {Array.from({ length: props.count }, (_, index) => props.row(index))}
    </SummonSkeleton>
  );
}

/**
 * Rows of a `SummonTableShell` list (title line, meta line, status badge). Put it inside the same shell as the
 * real rows.
 */
export function SummonTableRowsSkeleton(props: { count?: number; label?: string }) {
  return (
    <SummonSkeletonRows
      count={props.count ?? 8}
      className="divide-y divide-subtle"
      label={props.label}
      row={(index) => (
        <div key={index} className="flex items-start gap-3 px-4 py-3">
          <div className="min-w-0 flex-1">
            <SummonSkeletonText className="text-13 font-medium" width={index % 3 ? "w-48" : "w-72"} />
            {/* The meta line holds a bordered project badge, so it is taller than its text. */}
            <SummonSkeletonText className="mt-1 py-1 text-12" width="w-40" />
          </div>
          <SummonSkeletonBlock className="h-5 w-16 rounded-full" />
        </div>
      )}
    />
  );
}
