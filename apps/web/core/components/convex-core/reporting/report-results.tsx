import type { ReportSummary } from "./summary";

const label = (value: string) => value.replaceAll("_", " ");
function Metric({ name, value }: { name: string; value: number | string }) {
  return (
    <div>
      <dt className="text-14 text-secondary">{name}</dt>
      <dd className="mt-1 text-28 font-semibold break-all tabular-nums">{value}</dd>
    </div>
  );
}
export function ReportResults({ report }: { report: ReportSummary }) {
  const { tasks, projects } = report;
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
            <Metric name="Clients" value={report.clients} />
            <Metric name="Opportunities" value={report.opportunities} />
            <div className="col-span-2">
              <Metric name="Open pipeline value" value={report.pipelineValue} />
            </div>
          </dl>
        </section>
        <section aria-labelledby="knowledge-report">
          <h2 id="knowledge-report" className="mb-4 font-semibold">
            Knowledge & meetings
          </h2>
          <dl className="grid grid-cols-2 gap-5">
            <Metric name="Documents" value={report.documents} />
            <Metric name="Meetings" value={report.meetings} />
          </dl>
          <p className="mt-4 text-14 text-secondary">
            {report.meetingStatuses.scheduled} scheduled · {report.meetingStatuses.completed} completed ·{" "}
            {report.meetingStatuses.cancelled} cancelled
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
