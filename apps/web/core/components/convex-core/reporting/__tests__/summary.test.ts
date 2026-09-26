import assert from "node:assert/strict";
import { test } from "node:test";
import type { Id } from "@summon/convex/data-model";
import type { LoadedReport, ReportScope } from "../load-report";
import { completedReport, reportCsvRows } from "../summary.ts";
// Branded IDs here are static test fixtures, never untrusted UI/API input.
const scope: ReportScope = {
  workspaceId: "workspace-fixture" as Id<"workspaces">,
  projectId: "project-fixture" as Id<"projects">,
  clientId: "client-fixture" as Id<"clients">,
  dateFrom: "2026-09-01",
  dateTo: "2026-09-30",
  today: "2026-09-27",
};
const loaded: LoadedReport = {
  coverage: "complete",
  tasks: [{ total: 3, completed: 1, overdue: 1, dueInSevenDays: 1, later: 0, noDueDate: 0, completionTrend: {} }],
  projects: [],
  clients: [{ count: 2 }],
  opportunities: [
    { count: 1, pipelineValue: "9999999999999999.99", stages: { lead: { count: 1, value: "9999999999999999.99" } } },
    { count: 1, pipelineValue: "0.02", stages: { lead: { count: 1, value: "0.02" } } },
  ],
  documents: [{ count: 4 }],
  meetings: [{ total: 2, statuses: { scheduled: 1, completed: 1, cancelled: 0 }, trend: {} }],
};
test("display and CSV share one exact completed report summary and its applied scope", () => {
  const report = completedReport(loaded, scope);
  const rows = reportCsvRows(report);
  assert.equal(report.summary.pipelineValue, "10000000000000000.01");
  assert.deepEqual(
    rows.find((row) => row[0] === "Opportunity stage"),
    ["Opportunity stage", "lead", "10000000000000000.01"]
  );
  assert.deepEqual(
    rows.find((row) => row[0] === "Commercial" && row[1] === "Pipeline value"),
    ["Commercial", "Pipeline value", report.summary.pipelineValue]
  );
  assert.deepEqual(
    rows.find((row) => row[1] === "Issues"),
    ["Delivery", "Issues", String(report.summary.tasks.total)]
  );
  assert.deepEqual(
    rows.find((row) => row[1] === "Project ID"),
    ["Scope", "Project ID", scope.projectId]
  );
  assert.deepEqual(
    rows.find((row) => row[1] === "Client ID"),
    ["Scope", "Client ID", scope.clientId]
  );
  assert.deepEqual(
    rows.find((row) => row[1] === "From (UTC, inclusive)"),
    ["Scope", "From (UTC, inclusive)", scope.dateFrom]
  );
  assert.deepEqual(
    rows.find((row) => row[1] === "Through (UTC, inclusive)"),
    ["Scope", "Through (UTC, inclusive)", scope.dateTo]
  );
  assert.ok(!rows.some((row) => row[0] === "Accounting"));
});
test("unavailable or partially loading report state cannot export", () => {
  assert.throws(() => reportCsvRows(null), /Complete the report/);
});
