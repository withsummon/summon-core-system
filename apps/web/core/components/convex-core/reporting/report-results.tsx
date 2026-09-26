import type { LoadedReport } from "./load-report";
import { sumAmounts } from "./pages";

const label = (value: string) => value.replaceAll("_", " ");
function Metric({ name, value }: { name: string; value: number | string }) {
  return (
    <div>
      <dt className="text-14 text-secondary">{name}</dt>
      <dd className="mt-1 text-28 font-semibold break-all tabular-nums">{value}</dd>
    </div>
  );
}
export function ReportResults({ report }: { report: LoadedReport }) {
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
  const projects = report.projects.flatMap((part) => part.projects);
  return (
    <div className="space-y-8">
      <section aria-labelledby="delivery-report">
        <h2 id="delivery-report" className="mb-4 font-semibold">
          Delivery
        </h2>
        <dl className="grid grid-cols-2 gap-6 border-y border-subtle-1 py-5 sm:grid-cols-4">
          <Metric name="Tasks" value={tasks.total} />
          <Metric name="Completed" value={tasks.completed} />
          <Metric name="Overdue" value={tasks.overdue} />
          <Metric name="Due in 7 days" value={tasks.dueInSevenDays} />
        </dl>
        <p className="mt-3 text-14 text-secondary">
          Active tasks: {tasks.later} due later · {tasks.noDueDate} without a due date
        </p>
      </section>
      <div className="grid gap-8 lg:grid-cols-2">
        <section aria-labelledby="commercial-report">
          <h2 id="commercial-report" className="mb-4 font-semibold">
            Commercial
          </h2>
          <dl className="grid grid-cols-2 gap-5">
            <Metric name="Clients" value={report.clients.reduce((sum, part) => sum + part.count, 0)} />
            <Metric name="Opportunities" value={report.opportunities.reduce((sum, part) => sum + part.count, 0)} />
            <div className="col-span-2">
              <Metric
                name="Open pipeline value"
                value={sumAmounts(report.opportunities.map((part) => part.pipelineValue))}
              />
            </div>
          </dl>
        </section>
        <section aria-labelledby="knowledge-report">
          <h2 id="knowledge-report" className="mb-4 font-semibold">
            Knowledge & meetings
          </h2>
          <dl className="grid grid-cols-2 gap-5">
            <Metric name="Documents" value={report.documents.reduce((sum, part) => sum + part.count, 0)} />
            <Metric name="Meetings" value={report.meetings.reduce((sum, part) => sum + part.total, 0)} />
          </dl>
          <p className="mt-4 text-14 text-secondary">
            {report.meetings.reduce((sum, part) => sum + part.statuses.scheduled, 0)} scheduled ·{" "}
            {report.meetings.reduce((sum, part) => sum + part.statuses.completed, 0)} completed ·{" "}
            {report.meetings.reduce((sum, part) => sum + part.statuses.cancelled, 0)} cancelled
          </p>
        </section>
      </div>
      <section aria-labelledby="portfolio-report">
        <h2 id="portfolio-report" className="mb-4 font-semibold">
          Projects <span className="text-secondary">({projects.length})</span>
        </h2>
        {projects.length ? (
          <ul className="divide-y divide-subtle-1">
            {projects.map((project) => (
              <li key={project.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                <span className="min-w-0 break-words">
                  <span className="mr-3 text-14 text-secondary">{project.identifier}</span>
                  {project.name}
                </span>
                <span className="text-14 text-secondary capitalize">{label(project.health)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-14 text-secondary">No projects match this scope.</p>
        )}
      </section>
    </div>
  );
}
