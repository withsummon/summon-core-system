import { Component, useState } from "react";
import type { ReactNode } from "react";
import { Link, useSearchParams } from "react-router";
import { useQuery, usePaginatedQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import type { Id } from "@summon/convex/data-model";
import { api } from "@summon/convex/api";
import { Button } from "@plane/propel/button";
import { taskStatusOptions } from "../tasks/options";
import { DescriptionHistory } from "../tasks/description-history";
import { TaskAttachments } from "../tasks/attachments/attachments";
import { TaskRichEditor } from "../tasks/rich-editor";
import { IntakeTrash } from "./trash";
import { SubmissionForm } from "./forms";
import { DecisionForm, RemoveSubmission, intakeOptions } from "./decisions";
type Project = FunctionReturnType<typeof api.projects.index.list>[number];
export function Intakes({ project }: { project: Project }) {
  const [params, setParams] = useSearchParams();
  const selected = params.get("intake");
  const trash = params.get("intakeStatus") === "trash";
  const status = intakeOptions.find((option) => option.value === params.get("intakeStatus"))?.value ?? "pending";
  const config = useQuery(api.intakes.index.getConfig, { projectId: project._id });
  const submissions = usePaginatedQuery(
    api.intakes.index.list,
    selected || trash ? "skip" : { projectId: project._id, status },
    { initialNumItems: 30 }
  );
  const [creating, setCreating] = useState(false);
  const select = (id: Id<"tasks"> | null, created = false) => {
    setCreating(false);
    setParams((current) => {
      const next = new URLSearchParams(current);
      if (created) next.set("intakeStatus", "pending");
      if (id) next.set("intake", id);
      else next.delete("intake");
      return next;
    });
  };
  if (trash)
    return (
      <section className="space-y-4">
        <Button
          variant="secondary"
          onClick={() =>
            setParams((current) => {
              const next = new URLSearchParams(current);
              next.delete("intake");
              next.delete("intakeStatus");
              return next;
            })
          }
        >
          Back to active intake
        </Button>
        <IntakeBoundary key={selected ?? "trash"} onBack={() => select(null)}>
          <IntakeTrash
            project={project}
            selected={selected}
            onSelect={(id) =>
              setParams((current) => {
                const next = new URLSearchParams(current);
                if (id) next.set("intake", id);
                else next.delete("intake");
                return next;
              })
            }
            onRestored={(restoredStatus) =>
              setParams((current) => {
                const next = new URLSearchParams(current);
                next.delete("intake");
                next.set("intakeStatus", restoredStatus);
                return next;
              })
            }
          />
        </IntakeBoundary>
      </section>
    );
  if (creating)
    return (
      <SubmissionForm
        projectId={project._id}
        initial={null}
        onDone={(id) => select(id, true)}
        onCancel={() => setCreating(false)}
      />
    );
  if (selected)
    return (
      <IntakeBoundary key={selected} onBack={() => select(null)}>
        <IntakeDetail taskId={selected} project={project} onBack={() => select(null)} />
      </IntakeBoundary>
    );
  return (
    <section className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-24 font-semibold">Intake</h2>
          <p className="mt-1 text-14 text-secondary">Review work before admitting it to the project.</p>
        </div>
        {config?.enabled && <Button onClick={() => setCreating(true)}>Submit work</Button>}
      </header>
      {config && !config.enabled && (
        <p className="text-14 text-secondary">New submissions are disabled. Existing submissions remain available.</p>
      )}
      <nav aria-label="Intake status" className="flex flex-wrap gap-2">
        {intakeOptions.map((option) => (
          <Button
            key={option.value}
            variant={status === option.value ? "primary" : "secondary"}
            onClick={() =>
              setParams((current) => {
                const next = new URLSearchParams(current);
                next.set("intakeStatus", option.value);
                return next;
              })
            }
          >
            {option.label}
          </Button>
        ))}
        <Button
          variant="secondary"
          onClick={() =>
            setParams((current) => {
              const next = new URLSearchParams(current);
              next.set("intakeStatus", "trash");
              return next;
            })
          }
        >
          Trash
        </Button>
      </nav>
      <ul className="divide-y divide-subtle-1">
        {submissions.results.map(({ task, intake }) => (
          <li key={task._id}>
            <button
              className="grid w-full gap-1 py-4 text-left sm:grid-cols-[6rem_minmax(0,1fr)] sm:gap-3"
              onClick={() => select(task._id)}
            >
              <span className="text-12 text-secondary">
                {project.identifier}-{task.sequence}
              </span>
              <span className="min-w-0">
                <span className="block text-16 font-medium break-words">{task.title}</span>
                <span className="mt-1 block text-12 text-secondary capitalize">
                  {task.priority} priority
                  {intake.snoozedUntil !== null
                    ? ` · Snoozed until ${new Date(intake.snoozedUntil).toLocaleString()}`
                    : ""}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
      {submissions.status === "LoadingFirstPage" && <p role="status">Loading submissions…</p>}
      {submissions.status === "Exhausted" && !submissions.results.length && (
        <p className="text-14 text-secondary">No submissions available in this view.</p>
      )}
      {submissions.status === "CanLoadMore" && (
        <Button variant="secondary" onClick={() => submissions.loadMore(30)}>
          Load more submissions
        </Button>
      )}
    </section>
  );
}
function IntakeDetail({ taskId, project, onBack }: { taskId: string; project: Project; onBack: () => void }) {
  const detail = useQuery(api.intakes.index.resolve, { taskId });
  const [editing, setEditing] = useState(false),
    [reviewing, setReviewing] = useState(false);
  const [params] = useSearchParams();
  if (!detail) return <p role="status">Opening submission…</p>;
  if (detail.task.projectId !== project._id) return <Unavailable onBack={onBack} />;
  const taskRoute = (id: Id<"tasks">) => {
    const next = new URLSearchParams(params);
    next.delete("projectView");
    next.delete("intake");
    next.delete("intakeStatus");
    next.delete("taskView");
    next.set("task", id);
    return `?${next}`;
  };
  if (editing && detail.canEdit)
    return (
      <SubmissionForm
        projectId={project._id}
        initial={detail}
        onDone={() => setEditing(false)}
        onCancel={() => setEditing(false)}
      />
    );
  return (
    <article className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <Button variant="secondary" onClick={onBack}>
          Back to intake
        </Button>
        <div className="flex flex-wrap gap-2">
          <DescriptionHistory scope={{ kind: "intake", taskId: detail.task._id }} />
          {detail.canEdit && (
            <Button variant="secondary" onClick={() => setEditing(true)}>
              Edit submission
            </Button>
          )}
          {detail.canDecide && !reviewing && <Button onClick={() => setReviewing(true)}>Review submission</Button>}
        </div>
      </header>
      <div>
        <p className="mb-1 text-12 text-secondary">
          {project.identifier}-{detail.task.sequence} ·{" "}
          {intakeOptions.find((option) => option.value === detail.intake.status)?.label}
        </p>
        <h2 className="text-24 font-semibold break-words">{detail.task.title}</h2>
        <p className="mt-2 text-14 text-secondary capitalize">
          {detail.task.priority} priority · {taskStatusOptions[detail.task.status].label}
        </p>
      </div>
      {reviewing && detail.canDecide && <DecisionForm detail={detail} onClose={() => setReviewing(false)} />}
      {detail.intake.status === "accepted" && (
        <Link className="inline-block text-14 text-accent-primary hover:underline" to={taskRoute(detail.task._id)}>
          Open project task
        </Link>
      )}
      {detail.intake.snoozedUntil !== null && (
        <p className="text-14 text-secondary">Snoozed until {new Date(detail.intake.snoozedUntil).toLocaleString()}</p>
      )}
      {detail.intake.status === "duplicate" && (
        <div className="text-14">
          <span className="text-secondary">Duplicate of: </span>
          {detail.duplicateTarget ? (
            <Link className="text-accent-primary hover:underline" to={taskRoute(detail.duplicateTarget._id)}>
              {project.identifier}-{detail.duplicateTarget.sequence} · {detail.duplicateTarget.title}
            </Link>
          ) : (
            <span className="text-secondary">Task unavailable</span>
          )}
        </div>
      )}
      {detail.task.description.trim() && (
        <TaskRichEditor
          key={detail.task.updatedAt}
          id={`intake-description-${detail.task._id}`}
          label="Submission description"
          placeholder="Describe the submission…"
          html={detail.html}
          editable={false}
        />
      )}
      <TaskAttachments key={detail.task._id} taskId={detail.task._id} />
      {detail.canRemove && <RemoveSubmission detail={detail} onDone={onBack} />}
    </article>
  );
}
function Unavailable({ onBack }: { onBack: () => void }) {
  return (
    <section className="space-y-3">
      <h2 className="text-20 font-semibold">This submission is unavailable</h2>
      <p className="text-14 text-secondary">Check the project and your current intake access.</p>
      <Button variant="secondary" onClick={onBack}>
        Back to intake
      </Button>
    </section>
  );
}
class IntakeBoundary extends Component<{ children: ReactNode; onBack: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? <Unavailable onBack={this.props.onBack} /> : this.props.children;
  }
}
