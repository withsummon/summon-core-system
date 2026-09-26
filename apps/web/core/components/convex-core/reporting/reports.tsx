import { useEffect, useState } from "react";
import { useConvex, usePaginatedQuery, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "@summon/convex/api";
import { Button } from "@plane/propel/button";
import { Input } from "@plane/propel/input";
import { SummonField } from "@/components/summon/forms";
import { loadReport, type ReportScope } from "./load-report";
import { csvDownload } from "@plane/utils";
import { completedReport, reportCsvRows, type CompleteReport } from "./summary";
import { ReportResults } from "./report-results";
const selectClass = "h-10 w-full rounded-md border border-subtle-1 bg-surface-1 px-3 text-14";
export function Reports({ workspace }: { workspace: FunctionReturnType<typeof api.workspaces.index.list>[number] }) {
  const projects = useQuery(api.projects.index.list, { workspaceId: workspace._id });
  const clients = usePaginatedQuery(
    api.commercial.clients.list,
    { workspaceId: workspace._id },
    { initialNumItems: 50 }
  );
  const [project, setProject] = useState("");
  const [client, setClient] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [request, setRequest] = useState<{ scope: ReportScope; generation: number } | null>(null);
  const [error, setError] = useState("");
  return (
    <section className="max-w-6xl space-y-6">
      <header>
        <p className="text-14 text-secondary">{workspace.name}</p>
        <h1 className="mt-1 text-28 font-semibold">Reports</h1>
      </header>
      <form
        className="space-y-4 rounded-xl border border-subtle-1 bg-surface-1 p-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (dateFrom && dateTo && dateFrom > dateTo) {
            setError("The end date must be on or after the start date.");
            return;
          }
          const selectedProject = projects?.find((item) => item._id === project);
          const selectedClient = clients.results.find((item) => item._id === client);
          if ((project && !selectedProject) || (client && !selectedClient)) {
            setError("The selected scope is no longer available.");
            return;
          }
          setError("");
          setRequest((previous) => ({
            scope: {
              workspaceId: workspace._id,
              projectId: selectedProject?._id ?? null,
              clientId: selectedClient?._id ?? null,
              dateFrom: dateFrom || null,
              dateTo: dateTo || null,
              today: new Date().toISOString().slice(0, 10),
            },
            generation: (previous?.generation ?? 0) + 1,
          }));
        }}
      >
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <SummonField label="Project">
            <select
              className={selectClass}
              value={project}
              onChange={(event) => {
                setProject(event.target.value);
                setRequest(null);
              }}
            >
              <option value="">All accessible projects</option>
              {projects?.map((item) => (
                <option key={item._id} value={item._id}>
                  {item.name}
                </option>
              ))}
            </select>
          </SummonField>
          <SummonField label="Client">
            <select
              className={selectClass}
              value={client}
              onChange={(event) => {
                setClient(event.target.value);
                setRequest(null);
              }}
            >
              <option value="">All clients</option>
              {clients.results.map((item) => (
                <option key={item._id} value={item._id}>
                  {item.name}
                </option>
              ))}
            </select>
          </SummonField>
          <SummonField label="From">
            <Input
              type="date"
              value={dateFrom}
              onChange={(event) => {
                setDateFrom(event.target.value);
                setRequest(null);
              }}
            />
          </SummonField>
          <SummonField label="Through">
            <Input
              type="date"
              min={dateFrom || undefined}
              value={dateTo}
              onChange={(event) => {
                setDateTo(event.target.value);
                setRequest(null);
              }}
            />
          </SummonField>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-12 text-secondary">
            Dates use UTC. Task counts use creation date; meetings use meeting date.
          </p>
          <div className="flex gap-2">
            {clients.status === "CanLoadMore" && (
              <Button type="button" variant="secondary" onClick={() => clients.loadMore(50)}>
                Load more clients
              </Button>
            )}
            <Button type="submit" disabled={!projects || clients.status === "LoadingFirstPage"}>
              {request ? "Refresh report" : "Run report"}
            </Button>
          </div>
        </div>
        {error && (
          <p role="alert" className="text-14 text-danger-primary">
            {error}
          </p>
        )}
      </form>
      {request ? (
        <ReportRun key={request.generation} scope={request.scope} />
      ) : (
        <p className="py-8 text-14 text-secondary">Choose a scope and run the report to load all matching pages.</p>
      )}
    </section>
  );
}
function ReportRun({ scope }: { scope: ReportScope }) {
  const client = useConvex();
  const [result, setResult] = useState<CompleteReport | null>(null);
  const [pages, setPages] = useState(0);
  const [error, setError] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    void loadReport(client, scope, controller.signal, () => setPages((value) => value + 1))
      .then((report) => setResult(completedReport(report, scope)))
      .catch(() => {
        if (!controller.signal.aborted) {
          setError(true);
          controller.abort();
        }
      });
    return () => controller.abort();
  }, [client, scope]);
  if (error)
    return (
      <p role="alert" className="rounded-lg bg-danger-subtle p-4 text-danger-primary">
        The report could not be completed. Check your access and connection, then refresh. No partial totals are shown.
      </p>
    );
  if (!result)
    return (
      <p role="status" className="py-8 text-14 text-secondary">
        Loading report… {pages} pages checked. Totals appear when all pages are complete.
      </p>
    );
  return (
    <div className="space-y-6">
      <p role="status" className="text-12 text-secondary">
        All pages loaded · Changes made during loading may affect this report. Refresh for updated results.
      </p>
      <Button
        variant="secondary"
        onClick={() =>
          csvDownload(reportCsvRows(result), `summon-report-${scope.today}`, { formulaProtection: "text" })
        }
      >
        Download CSV
      </Button>
      <ReportResults report={result.summary} />
      <p className="border-t border-subtle-1 pt-4 text-12 text-secondary">
        Includes delivery, commercial, documents and meetings. Accounting, files and automation usage are not included.
      </p>
    </div>
  );
}
