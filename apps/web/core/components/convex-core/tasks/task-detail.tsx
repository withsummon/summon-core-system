import { TaskEstimate } from "../estimates/selection";
import { FavoriteToggle } from "../favorites/toggle";
import { Component, lazy, Suspense, useState } from "react";
import type { ReactNode } from "react";
import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
import { api } from "@summon/convex/api";
import type { FunctionArgs, FunctionReturnType } from "convex/server";
import type { Id } from "@summon/convex/data-model";
import { Button } from "@plane/propel/button";
import { Input } from "@plane/propel/input";
import { SummonField } from "@/components/summon/forms";
import { mutationMessage } from "../commercial/forms";
import { taskStatusOptions } from "./options";
import { TaskProperties } from "./task-properties";
import { TaskLifecycle } from "./lifecycle";
import { TaskSubscription } from "../notifications/task-subscription";

const RichDescription = lazy(() =>
  import("./rich-description").then((module) => ({ default: module.RichDescription }))
);
const TaskAttachments = lazy(() =>
  import("./attachments/attachments").then((module) => ({ default: module.TaskAttachments }))
);
const TaskLinks = lazy(() => import("./links/links").then((module) => ({ default: module.TaskLinks })));
const TaskReactions = lazy(() => import("./reactions/reactions").then((module) => ({ default: module.TaskReactions })));
const TaskComments = lazy(() => import("./comments").then((module) => ({ default: module.TaskComments })));
const TaskStructure = lazy(() => import("./task-structure").then((module) => ({ default: module.TaskStructure })));

type Project = FunctionReturnType<typeof api.projects.index.list>[number];
type Task = FunctionReturnType<typeof api.tasks.index.get>;
type Draft = FunctionArgs<typeof api.tasks.index.update>;

function TaskDetailContent({
  taskId,
  project,
  onBack,
  recovery = false,
}: {
  taskId: string;
  project: Project;
  onBack: () => void;
  recovery?: boolean;
}) {
  const active = useQuery(api.tasks.index.resolve, recovery ? "skip" : { taskId });
  const recovered = useQuery(api.tasks.lifecycle.get, recovery ? { taskId, view: "deleted" } : "skip");
  const task = recovery ? recovered : active;
  const [editing, setEditing] = useState(false);
  const states = useQuery(api.tasks.states.list, { projectId: project._id });
  const labels = useQuery(api.tasks.labels.list, { projectId: project._id });
  const canWrite = task?.canEdit === true;
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
        <div className="flex flex-wrap gap-2">
          {task.deletedAt === null && (
            <FavoriteToggle workspaceId={task.workspaceId} target={{ type: "issue", id: task._id }} />
          )}
          {task.deletedAt === null && <TaskSubscription taskId={task._id} />}
          {canWrite && !editing && <Button onClick={() => setEditing(true)}>Edit task</Button>}
        </div>
      </header>
      {task.deletedAt !== null ? (
        <p className="text-14 text-secondary">
          This task is in Trash. Restore it to access its retained comments and links.
        </p>
      ) : (
        task.archivedAt !== null && <p className="text-14 text-secondary">Archived task · read only</p>
      )}
      {editing && canWrite ? (
        <TaskForm task={task} projectId={project._id} onDone={() => setEditing(false)} />
      ) : (
        <>
          <h2 className="text-24 font-semibold break-words">{task.title}</h2>
          <dl className="grid gap-4 text-14 sm:grid-cols-3">
            <div>
              <dt className="text-secondary">State</dt>
              <dd>
                {states.find((state) => state._id === task.stateId)?.name ?? taskStatusOptions[task.status].label}
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
          {!recovery && <TaskEstimate taskId={task._id} />}
          {recovery ? (
            <p className="text-14 break-words whitespace-pre-wrap">{task.description}</p>
          ) : (
            <Suspense fallback={<p role="status">Loading task details…</p>}>
              <RichDescription taskId={task._id} canWrite={canWrite} />
              <TaskStructure task={task} canWrite={canWrite} />
              <TaskAttachments key={`attachments:${task._id}`} taskId={task._id} />
              <TaskLinks key={`links:${task._id}`} taskId={task._id} />
              <TaskReactions key={`reactions:${task._id}`} taskId={task._id} />
              <TaskComments key={task._id} taskId={task._id} />
            </Suspense>
          )}
        </>
      )}
      <TaskLifecycle task={task} />
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
    estimatePointId: task.estimatePointId,
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

export function TaskDetail(props: { taskId: string; project: Project; onBack: () => void; recovery?: boolean }) {
  return (
    <TaskAccessBoundary key={`${props.taskId}:${props.recovery ? "deleted" : "read"}`} onBack={props.onBack}>
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
