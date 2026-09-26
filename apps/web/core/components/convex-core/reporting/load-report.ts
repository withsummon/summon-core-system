import type { ConvexReactClient } from "convex/react";
import type { FunctionArgs } from "convex/server";
import { api } from "@summon/convex/api";
import { readReportPages } from "./pages";
export type ReportScope = FunctionArgs<typeof api.reporting.tasks.page>["scope"];
const paginationOpts = (cursor: string | null) => ({ numItems: 100, cursor });
export async function loadReport(
  client: ConvexReactClient,
  scope: ReportScope,
  signal: AbortSignal,
  progress: () => void
) {
  const [tasks, projects, clients, opportunities, meetings, documents] = await Promise.all([
    readReportPages(
      (cursor) => client.query(api.reporting.tasks.page, { scope, paginationOpts: paginationOpts(cursor) }),
      signal,
      progress
    ),
    readReportPages(
      (cursor) => client.query(api.reporting.projects.page, { scope, paginationOpts: paginationOpts(cursor) }),
      signal,
      progress
    ),
    readReportPages(
      (cursor) => client.query(api.reporting.commercial.clients, { scope, paginationOpts: paginationOpts(cursor) }),
      signal,
      progress
    ),
    readReportPages(
      (cursor) =>
        client.query(api.reporting.commercial.opportunities, { scope, paginationOpts: paginationOpts(cursor) }),
      signal,
      progress
    ),
    readReportPages(
      (cursor) => client.query(api.reporting.meetings.page, { scope, paginationOpts: paginationOpts(cursor) }),
      signal,
      progress
    ),
    readReportPages(
      (cursor) => client.query(api.reporting.documents.page, { scope, paginationOpts: paginationOpts(cursor) }),
      signal,
      progress
    ),
  ]);
  return { coverage: "complete" as const, tasks, projects, clients, opportunities, meetings, documents };
}
export type LoadedReport = Awaited<ReturnType<typeof loadReport>>;
