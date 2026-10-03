/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { useEffect, useState } from "react";
import { useOutletContext, useSearchParams } from "react-router";
import { useQuery } from "convex/react";
import { usePaginatedQuery } from "convex-helpers/react";
import { api } from "@summon/convex/api";
import { csvDownload } from "@plane/utils";
import type { WorkspaceSession } from "@/components/workspace/native-shell/session";
import { PreservedWorkspaceShell } from "@/components/workspace/native-shell/workspace-shell";
import { useStickiesCommands } from "@/components/stickies/native/provider";
import { aggregateReport, reportCsvRows, type CompleteReport } from "@/components/convex-core/reporting/summary";
import type { ReportScope } from "@/components/convex-core/reporting/load-report";
import { ReportView } from "./report-view";
import { readReportFilters, updateReportFilter, type TReportFilterParam } from "./report-view-model";

export default function SummonReportsPage() {
  const session = useOutletContext<WorkspaceSession>();
  const commands = useStickiesCommands();
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = readReportFilters(searchParams);
  const [today] = useState(() => new Date().toISOString().slice(0, 10));
  const selection = useQuery(api.reporting.scope.resolve, {
    workspaceId: session.workspace._id,
    projectId: filters.projectId ?? null,
    clientId: filters.clientId ?? null,
    dateFrom: filters.dateFrom ?? null,
    dateTo: filters.dateTo ?? null,
    today,
  });
  return (
    <PreservedWorkspaceShell
      {...session}
      onCreateSticky={commands.create}
      onOpenStickies={commands.openAll}
      beforeLeave={commands.flushAll}
    >
      {selection?.scope ? (
        <NativeReport
          key={JSON.stringify(selection.scope)}
          scope={selection.scope}
          workspaceSlug={session.workspace.slug}
          onFilterChange={(name, value) =>
            setSearchParams(updateReportFilter(searchParams, name, value), { replace: true })
          }
        />
      ) : selection?.error ? (
        <div className="p-5">
          <p role="alert">{selection.error}</p>
          <button type="button" className="mt-3 text-accent-primary" onClick={() => setSearchParams({})}>
            Reset report filters
          </button>
        </div>
      ) : (
        <p role="status" className="p-5">
          Loading report scope…
        </p>
      )}
    </PreservedWorkspaceShell>
  );
}

function NativeReport({
  scope,
  workspaceSlug,
  onFilterChange,
}: {
  scope: ReportScope;
  workspaceSlug: string;
  onFilterChange: (name: TReportFilterParam, value: string) => void;
}) {
  const args = { scope };
  const options = { initialNumItems: 100 };
  const tasks = usePaginatedQuery(api.reporting.tasks.page, args, options);
  const projects = usePaginatedQuery(api.reporting.projects.page, args, options);
  const clients = usePaginatedQuery(api.reporting.commercial.clients, args, options);
  const opportunities = usePaginatedQuery(api.reporting.commercial.opportunities, args, options);
  const meetings = usePaginatedQuery(api.reporting.meetings.page, args, options);
  const documents = usePaginatedQuery(api.reporting.documents.page, args, options);
  const projectOptions = useQuery(api.projects.index.list, { workspaceId: scope.workspaceId });
  const clientOptions = usePaginatedQuery(api.commercial.clients.list, { workspaceId: scope.workspaceId }, options);
  const traversals = [tasks, projects, clients, opportunities, meetings, documents, clientOptions];
  useEffect(() => {
    for (const traversal of traversals) if (traversal.status === "CanLoadMore") traversal.loadMore(100);
  });
  const complete = traversals.every((traversal) => traversal.status === "Exhausted");
  const summary = complete
    ? aggregateReport({
        coverage: "complete",
        tasks: tasks.results,
        projects: projects.results,
        clients: clients.results,
        opportunities: opportunities.results,
        meetings: meetings.results,
        documents: documents.results,
      })
    : undefined;
  const report: CompleteReport | null = summary
    ? { scope, summary, coverage: "complete", completedAt: new Date().toISOString() }
    : null;
  const onExport = () =>
    csvDownload(reportCsvRows(report), `summon-report-${scope.today}`, { formulaProtection: "text" });
  return (
    <ReportView
      workspaceSlug={workspaceSlug}
      data={summary}
      report={report}
      isLoading={!complete}
      filters={{
        projectId: scope.projectId ?? undefined,
        clientId: scope.clientId ?? undefined,
        dateFrom: scope.dateFrom ?? undefined,
        dateTo: scope.dateTo ?? undefined,
      }}
      projects={projectOptions ?? []}
      clients={clientOptions.results}
      onExport={onExport}
      onFilterChange={onFilterChange}
      onRetry={() => window.location.reload()}
    />
  );
}
