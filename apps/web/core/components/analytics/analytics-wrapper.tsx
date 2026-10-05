/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useEffect, useState, type ReactNode } from "react";
import { useConvex, type ConvexReactClient } from "convex/react";
import type { FunctionArgs, FunctionReturnType } from "convex/server";
import { api } from "@summon/convex/api";
import { useTranslation } from "@plane/i18n";
import { cn } from "@plane/utils";
import { readReportPages } from "@/components/convex-core/reporting/pages";
import { mutationMessage } from "@/components/convex-core/commercial/forms";
export type AnalyticsScope = FunctionArgs<typeof api.reporting.analytics.tasks>["scope"];
export type TaskCounts = FunctionReturnType<typeof api.reporting.analytics.tasks>["contribution"]["counts"];
export function addCounts(a: TaskCounts, b: TaskCounts): TaskCounts {
  return {
    total: a.total + b.total,
    backlog: a.backlog + b.backlog,
    todo: a.todo + b.todo,
    in_progress: a.in_progress + b.in_progress,
    done: a.done + b.done,
    cancelled: a.cancelled + b.cancelled,
  };
}
export async function readTasks(client: ConvexReactClient, scope: AnalyticsScope, signal: AbortSignal) {
  const pages = await readReportPages(
    (cursor) => client.query(api.reporting.analytics.tasks, { scope, paginationOpts: { cursor, numItems: 100 } }),
    signal,
    () => {}
  );
  const first = pages[0];
  const counts = pages.slice(1).reduce((sum, page) => addCounts(sum, page.counts), first.counts);
  const projects = new Map<string, (typeof first.projects)[number]>();
  const assignees = new Map<string, (typeof first.assignees)[number]>();
  for (const page of pages) {
    for (const row of page.projects) {
      const previous = projects.get(row.project.id);
      projects.set(row.project.id, { ...row, counts: previous ? addCounts(previous.counts, row.counts) : row.counts });
    }
    for (const row of page.assignees) {
      const previous = assignees.get(row.key);
      assignees.set(row.key, { ...row, counts: previous ? addCounts(previous.counts, row.counts) : row.counts });
    }
  }
  return {
    counts,
    // eslint-disable-next-line unicorn/no-array-sort -- ES2020 target; this newly allocated array has no shared owner.
    projects: [...projects.values()].sort((a, b) => a.project.id.localeCompare(b.project.id)),
    // eslint-disable-next-line unicorn/no-array-sort -- ES2020 target; this newly allocated array has no shared owner.
    assignees: [...assignees.values()].sort((a, b) => a.key.localeCompare(b.key)),
  };
}
export async function readProjects(
  client: ConvexReactClient,
  workspaceId: AnalyticsScope["workspaceId"],
  signal: AbortSignal
) {
  return (
    await readReportPages(
      (cursor) =>
        client.query(api.reporting.analytics.projects, { workspaceId, paginationOpts: { cursor, numItems: 100 } }),
      signal,
      () => {}
    )
  ).flat();
}
/** Publishes only an exhausted traversal; selection changes discard the previous report. */
export function useAnalyticsReport<T>(
  read: (client: ConvexReactClient, signal: AbortSignal) => Promise<T>,
  request: number | string
) {
  const client = useConvex();
  const [report, setReport] = useState<{ data: T | null; error: string | null }>({ data: null, error: null });
  useEffect(() => {
    const abort = new AbortController();
    setReport({ data: null, error: null });
    void read(client, abort.signal)
      .then((data) => {
        if (!abort.signal.aborted) setReport({ data, error: null });
        return data;
      })
      .catch((error) => {
        if (!abort.signal.aborted) setReport({ data: null, error: mutationMessage(error) });
      });
    return () => abort.abort();
  }, [client, read, request]);
  return { ...report, isLoading: report.data === null && report.error === null };
}
export function AnalyticsError({ error }: { error: string | null }) {
  return error ? (
    <p role="alert" className="rounded border border-danger-subtle p-4 text-13 text-danger-primary">
      {error}
    </p>
  ) : null;
}
export default function AnalyticsWrapper({
  i18nTitle,
  children,
  className,
}: {
  i18nTitle: string;
  children: ReactNode;
  className?: string;
}) {
  const { t } = useTranslation();
  return (
    <div className={cn("px-6 py-4", className)}>
      <h1 className="mb-4 text-20 font-bold md:mb-6">{t(i18nTitle)}</h1>
      {children}
    </div>
  );
}
