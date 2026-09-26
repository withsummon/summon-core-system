import { Component, lazy, Suspense, useState } from "react";
import type { ReactNode } from "react";
import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
import { api } from "@summon/convex/api";
import type { FunctionArgs, FunctionReturnType } from "convex/server";
import type { Id } from "@summon/convex/data-model";
import { Button } from "@plane/propel/button";
import { Input } from "@plane/propel/input";
import { SummonField } from "@/components/summon/forms";
import { mutationMessage, selectClass } from "../commercial/forms";
import { statusOptions } from "./options";

const RichDescription = lazy(() =>
  import("./rich-description").then((module) => ({ default: module.RichDescription }))
);
const TaskStructure = lazy(() => import("./task-structure").then((module) => ({ default: module.TaskStructure })));

type Project = FunctionReturnType<typeof api.projects.index.list>[number];
type Task = FunctionReturnType<typeof api.tasks.index.get>;
type Draft = FunctionArgs<typeof api.tasks.index.update>;
const priorities = ["none", "urgent", "high", "medium", "low"] as const satisfies Draft["priority"][];

function TaskDetailContent({ taskId, project, onBack }: { taskId: string; project: Project; onBack: () => void }) {
  const task = useQuery(api.tasks.index.resolve, { taskId });
  const [editing, setEditing] = useState(false);
  const states = useQuery(api.tasks.states.list, { projectId: project._id });
  const labels = useQuery(api.tasks.labels.list, { projectId: project._id });
  const canWrite = project.membershipRole !== "guest" && project.workspaceRole !== "guest";
  if (!task || !states || !labels) return <p role="status">Opening task…</p>;
  if (task.projectId !== project._id) return <TaskUnavailable onBack={onBack} />;
  return (
    <article className="space-y-5">
      <header className="flex flex-wrap justify-between gap-3">
        <Button variant="secondary" onClick={onBack}>
          Back to tasks
        </Button>
        <span className="text-14 text-secondary">
          {project.identifier}-{task.sequence}
        </span>
        {canWrite && !editing && <Button onClick={() => setEditing(true)}>Edit task</Button>}
      </header>
      {editing && canWrite ? (
        <TaskForm task={task} projectId={project._id} onDone={() => setEditing(false)} />
      ) : (
        <>
          <h2 className="text-24 font-semibold break-words">{task.title}</h2>
          <dl className="grid gap-4 text-14 sm:grid-cols-3">
            <div>
              <dt className="text-secondary">State</dt>
              <dd>
                {states.find((state) => state._id === task.stateId)?.name ??
                  statusOptions.find((state) => state.value === task.status)?.label}
              </dd>
            </div>
            <div>
              <dt className="text-secondary">Priority</dt>
              <dd className="capitalize">{task.priority}</dd>
            </div>
            <div>
              <dt className="text-secondary">Dates</dt>
              <dd>
                {task.startDate || "No start date"} → {task.targetDate || "No due date"}
              </dd>
            </div>
            <div>
              <dt className="text-secondary">Labels</dt>
              <dd>
                {labels
                  .filter((label) => task.labelIds.includes(label._id))
                  .map((label) => label.name)
                  .join(", ") || "None"}
              </dd>
            </div>
            <div>
              <dt className="text-secondary">Assignees</dt>
              <dd>
                <AssigneeNames projectId={project._id} ids={task.assigneeIds} />
              </dd>
            </div>
          </dl>
          <Suspense fallback={<p role="status">Loading task details…</p>}>
            <RichDescription taskId={task._id} canWrite={canWrite} />
            <TaskStructure task={task} canWrite={canWrite} />
          </Suspense>
        </>
      )}
    </article>
  );
}
function AssigneeNames({ projectId, ids }: { projectId: Id<"projects">; ids: Id<"users">[] }) {
  const { results, status, loadMore } = usePaginatedQuery(
    api.tasks.assignees.list,
    { projectId },
    { initialNumItems: 100 }
  );
  return (
    <>
      {ids.length === 0
        ? "Unassigned"
        : ids
            .map((id) => {
              const person = results.find((user) => user.id === id);
              return person?.name || person?.email || "Member unavailable or not loaded";
            })
            .join(", ")}
      {status === "CanLoadMore" && (
        <Button variant="secondary" onClick={() => loadMore(100)}>
          Load more members
        </Button>
      )}
    </>
  );
}
function TaskForm({ task, projectId, onDone }: { task: Task; projectId: Id<"projects">; onDone: () => void }) {
  const save = useMutation(api.tasks.index.update);
  const [draft, setDraft] = useState<Draft>({
    taskId: task._id,
    expectedUpdatedAt: task.updatedAt,
    title: task.title,
    description: task.description,
    status: task.status,
    priority: task.priority,
    assigneeIds: task.assigneeIds,
    labelIds: task.labelIds,
    startDate: task.startDate,
    targetDate: task.targetDate,
    stateId: task.stateId,
  });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  return (
    <form
      className="space-y-5"
      onSubmit={async (event) => {
        event.preventDefault();
        setPending(true);
        setError("");
        try {
          await save(draft);
          onDone();
        } catch (failure) {
          setError(mutationMessage(failure));
        } finally {
          setPending(false);
        }
      }}
    >
      <fieldset disabled={pending} className="space-y-5">
        <SummonField label="Task title">
          <Input
            value={draft.title}
            maxLength={255}
            required
            onChange={(event) => setDraft({ ...draft, title: event.target.value })}
          />
        </SummonField>
        <TaskProperties projectId={projectId} draft={draft} onChange={setDraft} />
        <div className="flex gap-2">
          <Button type="submit" loading={pending}>
            Save task
          </Button>
          <Button variant="secondary" onClick={onDone}>
            Cancel
          </Button>
        </div>
      </fieldset>
      {error && (
        <p role="alert" className="text-14 text-danger-primary">
          {error}
        </p>
      )}
    </form>
  );
}
function TaskProperties({
  projectId,
  draft,
  onChange,
}: {
  projectId: Id<"projects">;
  draft: Draft;
  onChange: (draft: Draft) => void;
}) {
  const states = useQuery(api.tasks.states.list, { projectId });
  const labels = useQuery(api.tasks.labels.list, { projectId });
  const {
    results: members,
    status,
    loadMore,
  } = usePaginatedQuery(api.tasks.assignees.list, { projectId }, { initialNumItems: 100 });
  return (
    <div className="grid gap-5 sm:grid-cols-2">
      <SummonField label="State" htmlFor="task-state">
        <select
          id="task-state"
          className={selectClass}
          value={draft.stateId ?? draft.status}
          onChange={(event) => {
            const state = states?.find((item) => item._id === event.target.value);
            if (state) onChange({ ...draft, stateId: state._id, status: state.status });
            else {
              const group = statusOptions.find((item) => item.value === event.target.value);
              if (group) onChange({ ...draft, stateId: null, status: group.value });
            }
          }}
        >
          <optgroup label="Status groups">
            {statusOptions.map((item) => (
              <option value={item.value} key={item.value}>
                {item.label}
              </option>
            ))}
          </optgroup>
          <optgroup label="Project states">
            {states?.map((state) => (
              <option value={state._id} key={state._id}>
                {state.name}
              </option>
            ))}
          </optgroup>
        </select>
      </SummonField>
      <SummonField label="Priority" htmlFor="task-priority">
        <select
          id="task-priority"
          className={selectClass}
          value={draft.priority}
          onChange={(event) => {
            const priority = priorities.find((value) => value === event.target.value);
            if (priority) onChange({ ...draft, priority });
          }}
        >
          {priorities.map((priority) => (
            <option value={priority} key={priority}>
              {priority.charAt(0).toUpperCase() + priority.slice(1)}
            </option>
          ))}
        </select>
      </SummonField>
      <SummonField label="Start date">
        <Input
          type="date"
          value={draft.startDate ?? ""}
          max={draft.targetDate ?? undefined}
          onChange={(event) => onChange({ ...draft, startDate: event.target.value || null })}
        />
      </SummonField>
      <SummonField label="Due date">
        <Input
          type="date"
          value={draft.targetDate ?? ""}
          min={draft.startDate ?? undefined}
          onChange={(event) => onChange({ ...draft, targetDate: event.target.value || null })}
        />
      </SummonField>
      <fieldset className="space-y-2">
        <legend className="mb-2 text-14 font-medium">Assignees</legend>
        {members.map((member) => (
          <label key={member.id} className="flex gap-2 text-14">
            <input
              type="checkbox"
              checked={draft.assigneeIds.includes(member.id)}
              onChange={(event) =>
                onChange({
                  ...draft,
                  assigneeIds: event.target.checked
                    ? [...draft.assigneeIds, member.id]
                    : draft.assigneeIds.filter((id) => id !== member.id),
                })
              }
            />
            {member.name || member.email || member.id}
          </label>
        ))}
        {status === "CanLoadMore" && (
          <Button variant="secondary" onClick={() => loadMore(100)}>
            Load more members
          </Button>
        )}
        {draft.assigneeIds
          .filter((id) => !members.some((member) => member.id === id))
          .map((id) => (
            <label key={id} className="flex gap-2 text-14">
              <input
                type="checkbox"
                checked
                onChange={() => onChange({ ...draft, assigneeIds: draft.assigneeIds.filter((value) => value !== id) })}
              />
              Member unavailable or not loaded ({id})
            </label>
          ))}
      </fieldset>
      <fieldset className="space-y-2">
        <legend className="mb-2 text-14 font-medium">Labels</legend>
        {labels?.map((label) => (
          <label key={label._id} className="flex gap-2 text-14">
            <input
              type="checkbox"
              checked={draft.labelIds.includes(label._id)}
              onChange={(event) =>
                onChange({
                  ...draft,
                  labelIds: event.target.checked
                    ? [...draft.labelIds, label._id]
                    : draft.labelIds.filter((id) => id !== label._id),
                })
              }
            />
            <span style={{ color: label.color }} aria-hidden>
              ●
            </span>
            {label.name}
          </label>
        ))}
        {labels?.length === 0 && <p className="text-14 text-secondary">No project labels yet.</p>}
      </fieldset>
    </div>
  );
}

export function TaskDetail(props: { taskId: string; project: Project; onBack: () => void }) {
  return (
    <TaskAccessBoundary key={props.taskId} onBack={props.onBack}>
      <TaskDetailContent {...props} />
    </TaskAccessBoundary>
  );
}
function TaskUnavailable({ onBack }: { onBack: () => void }) {
  return (
    <section className="space-y-4">
      <h2 className="text-20 font-semibold">This task is unavailable</h2>
      <p role="alert" className="text-14 text-secondary">
        It may have been removed, or your access may have changed.
      </p>
      <Button variant="secondary" onClick={onBack}>
        Back to tasks
      </Button>
    </section>
  );
}
class TaskAccessBoundary extends Component<{ children: ReactNode; onBack: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? <TaskUnavailable onBack={this.props.onBack} /> : this.props.children;
  }
}
