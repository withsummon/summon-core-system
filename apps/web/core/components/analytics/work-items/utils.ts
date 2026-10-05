/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { FunctionArgs } from "convex/server";
import { api } from "@summon/convex/api";
const priorityColors: Record<string, string> = {
  urgent: "#ef4444",
  high: "#f97316",
  medium: "#eab308",
  low: "#22c55e",
  none: "#ced4da",
};
export function generateBarColor(
  value: string,
  axis: FunctionArgs<typeof api.reporting.analytics.chart>["axis"],
  color: string | null
): string {
  return color ?? (axis === "priority" ? priorityColors[value] : undefined) ?? "var(--text-color-accent-primary)";
}
