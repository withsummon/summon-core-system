import type { LoadedReport, ReportScope } from "./load-report";
import { sumAmounts } from "./pages.ts";
export function aggregateReport(report: LoadedReport) {
  const tasks = report.tasks.reduce(
    (sum, part) => ({
      total: sum.total + part.total,
      completed: sum.completed + part.completed,
      overdue: sum.overdue + part.overdue,
      dueInSevenDays: sum.dueInSevenDays + part.dueInSevenDays,
      later: sum.later + part.later,
      noDueDate: sum.noDueDate + part.noDueDate,
    }),
    { total: 0, completed: 0, overdue: 0, dueInSevenDays: 0, later: 0, noDueDate: 0 }
  );
  const meetingStatuses = report.meetings.reduce(
    (sum, part) => ({
      scheduled: sum.scheduled + part.statuses.scheduled,
      completed: sum.completed + part.statuses.completed,
      cancelled: sum.cancelled + part.statuses.cancelled,
    }),
    { scheduled: 0, completed: 0, cancelled: 0 }
  );
  const opportunityStages: Record<string, { count: number; value: string }> = {};
  for (const part of report.opportunities)
    for (const [stage, contribution] of Object.entries(part.stages)) {
      const previous = opportunityStages[stage] ?? { count: 0, value: "0.00" };
      opportunityStages[stage] = {
        count: previous.count + contribution.count,
        value: sumAmounts([previous.value, contribution.value]),
      };
    }
  return {
    opportunityStages,
    tasks,
    projects: report.projects.flatMap((part) => part.projects),
    clients: report.clients.reduce((sum, part) => sum + part.count, 0),
    opportunities: report.opportunities.reduce((sum, part) => sum + part.count, 0),
    pipelineValue: sumAmounts(report.opportunities.map((part) => part.pipelineValue)),
    documents: report.documents.reduce((sum, part) => sum + part.count, 0),
    meetings: report.meetings.reduce((sum, part) => sum + part.total, 0),
    meetingStatuses,
  };
}
export type ReportSummary = ReturnType<typeof aggregateReport>;
export type CompleteReport = { scope: ReportScope; summary: ReportSummary; completedAt: string; coverage: "complete" };
export function completedReport(report: LoadedReport, scope: ReportScope): CompleteReport {
  return { summary: aggregateReport(report), scope, coverage: report.coverage, completedAt: new Date().toISOString() };
}
export function reportCsvRows(report: CompleteReport | null): string[][] {
  if (!report) throw new Error("Complete the report before exporting.");
  const { summary, scope } = report;
  const rows: string[][] = [
    ["Section", "Label", "Value"],
    ["Scope", "Workspace ID", scope.workspaceId],
    ["Scope", "Project ID", scope.projectId ?? "All accessible projects"],
    ["Scope", "Client ID", scope.clientId ?? "All clients"],
    ["Scope", "From (UTC, inclusive)", scope.dateFrom ?? "Unbounded"],
    ["Scope", "Through (UTC, inclusive)", scope.dateTo ?? "Unbounded"],
    ["Scope", "Due buckets as of (UTC)", scope.today],
    ["Coverage", "Completed at", report.completedAt],
    ["Coverage", "Pages", "All pages loaded; traversal is not a globally atomic snapshot"],
    ["Portfolio", "Projects", String(summary.projects.length)],
    ["Delivery", "Issues", String(summary.tasks.total)],
    ["Delivery", "Completed", String(summary.tasks.completed)],
    ["Delivery", "Overdue", String(summary.tasks.overdue)],
    ["Delivery", "Due in 7 days", String(summary.tasks.dueInSevenDays)],
    ["Delivery", "Later", String(summary.tasks.later)],
    ["Delivery", "No due date", String(summary.tasks.noDueDate)],
    ["Commercial", "Clients", String(summary.clients)],
    ["Commercial", "Opportunities", String(summary.opportunities)],
    ["Commercial", "Pipeline value", summary.pipelineValue],
    ["Knowledge", "Pages", String(summary.documents)],
    ["Meetings", "Total", String(summary.meetings)],
    ["Meetings", "Scheduled", String(summary.meetingStatuses.scheduled)],
    ["Meetings", "Completed", String(summary.meetingStatuses.completed)],
    ["Meetings", "Cancelled", String(summary.meetingStatuses.cancelled)],
    ["Coverage", "Excluded", "Accounting, files, automation, client status rows, recent activity"],
  ];
  rows.push(
    ...Object.entries(summary.opportunityStages).map(([stage, value]) => ["Opportunity stage", stage, value.value])
  );
  rows.push(...summary.projects.map((project) => ["Project health", project.name, project.health]));
  return rows;
}
