/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { ISummonReportFilters } from "@plane/types";

export type TReportFilterParam = "project_id" | "client_id" | "date_from" | "date_to";

export const percentage = (value: number, total: number) => (total > 0 ? Math.round((value / total) * 100) : 0);

export function readReportFilters(searchParams: URLSearchParams): ISummonReportFilters {
  return {
    projectId: searchParams.get("project_id") || undefined,
    clientId: searchParams.get("client_id") || undefined,
    dateFrom: searchParams.get("date_from") || undefined,
    dateTo: searchParams.get("date_to") || undefined,
  };
}

export function updateReportFilter(searchParams: URLSearchParams, name: TReportFilterParam, value: string) {
  const next = new URLSearchParams(searchParams);
  if (value) next.set(name, value);
  else next.delete(name);
  return next;
}

export const reportRequestKey = (workspaceSlug: string, filters: ISummonReportFilters) =>
  [
    "summon-report",
    workspaceSlug,
    filters.projectId ?? "",
    filters.clientId ?? "",
    filters.dateFrom ?? "",
    filters.dateTo ?? "",
  ] as const;

export function reportLabel(value: string) {
  const label = value.replaceAll(/[_-]+/g, " ");
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function trendPolylinePoints(values: number[], width = 320, height = 80) {
  if (values.length === 0) return "";
  const max = Math.max(1, ...values);
  const divisor = Math.max(1, values.length - 1);
  return values
    .map((value, index) => `${Math.round((index / divisor) * width)},${Math.round(height - (value / max) * height)}`)
    .join(" ");
}
