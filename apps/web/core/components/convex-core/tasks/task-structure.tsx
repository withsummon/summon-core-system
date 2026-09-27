import { relatedTaskRoute } from "./structure-route";
import { Component, useState } from "react";
import type { ReactNode } from "react";
import { Link, useSearchParams } from "react-router";
import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
import { api } from "@summon/convex/api";
import type { Doc, Id } from "@summon/convex/data-model";
import type { FunctionArgs } from "convex/server";
import { Button } from "@plane/propel/button";
import { Input } from "@plane/propel/input";
import { SummonField } from "@/components/summon/forms";
import { mutationMessage, selectClass } from "../commercial/forms";
type Task = Doc<"tasks">;
type RelationDirection = FunctionArgs<typeof api.tasks.relationships.add>["kind"];
const relationLabels = {
  blocks: "Blocks",
  blocked_by: "Blocked by",
  relates_to: "Relates to",
  duplicate: "Duplicate",
  start_before: "Start before",
  start_after: "Start after",
  finish_before: "Finish before",
  finish_after: "Finish after",
  implemented_by: "Implemented by",
  implements: "Implements",
} satisfies Record<RelationDirection, string>;
const relationDirections = [
  "blocks",
  "blocked_by",
  "relates_to",
  "duplicate",
  "start_before",
  "start_after",
  "finish_before",
  "finish_after",
  "implemented_by",
  "implements",
] as const satisfies readonly RelationDirection[];

function TaskLink({ task, projectIdentifier }: { task: Task; projectIdentifier?: string }) {
  const [params] = useSearchParams();
  const next = new URLSearchParams(params);
  next.delete("comment");
  next.set("task", task._id);
  next.delete("taskView");
  return (
    <Link
      className="min-w-0 text-14 break-words text-accent-primary hover:underline"
      to={projectIdentifier ? relatedTaskRoute(params, task._id, projectIdentifier) : `?${next}`}
    >
      {projectIdentifier ? `${projectIdentifier}-` : "#"}
      {task.sequence} · {task.title}
    </Link>
  );
}
export function TaskStructure({ task, canWrite }: { task: Task; canWrite: boolean }) {
  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <Hierarchy task={task} canWrite={canWrite} />
      <Relationships task={task} canWrite={canWrite} />
    </div>
  );
}
function Hierarchy({ task, canWrite }: { task: Task; canWrite: boolean }) {
  const parent = useQuery(api.tasks.hierarchy.parent, { taskId: task._id });
  const { results, status, loadMore } = usePaginatedQuery(
    api.tasks.hierarchy.children,
    { taskId: task._id },
    { initialNumItems: 50 }
  );
  const setParent = useMutation(api.tasks.hierarchy.setParent);
  const [mode, setMode] = useState<"parent" | "create" | "link" | null>(null);
  const [error, setError] = useState("");
  return (
    <section className="space-y-4 rounded-xl border border-subtle-1 p-4">
      <header className="flex flex-wrap justify-between gap-3">
        <h3 className="text-16 font-medium">Parent & subtasks</h3>
        {canWrite && (
          <Button variant="secondary" onClick={() => setMode("parent")}>
            {parent?.hasParent ? "Change parent" : "Set parent"}
          </Button>
        )}
      </header>
      <div className="text-14">
        <span className="mr-2 text-secondary">Parent</span>
        {parent?.task ? (
          <TaskLink task={parent.task} />
        ) : parent ? (
          parent.hasParent ? (
            "Parent task unavailable"
          ) : (
            "None"
          )
        ) : (
          "Loading…"
        )}
      </div>
      {canWrite && parent?.hasParent && (
        <Button
          variant="secondary"
          onClick={() => {
            void setParent({ taskId: task._id, expectedUpdatedAt: task.updatedAt, parent: null }).catch((failure) =>
              setError(mutationMessage(failure))
            );
          }}
        >
          Remove parent link
        </Button>
      )}
      <ul className="space-y-3">
        {results.map((child) => (
          <li className="flex flex-wrap items-center justify-between gap-2" key={child._id}>
            <TaskLink task={child} />
            {canWrite && child.archivedAt == null && (
              <Button
                variant="secondary"
                onClick={() => {
                  void setParent({ taskId: child._id, expectedUpdatedAt: child.updatedAt, parent: null }).catch(
                    (failure) => setError(mutationMessage(failure))
                  );
                }}
              >
                Unlink subtask
              </Button>
            )}
          </li>
        ))}
      </ul>
      {status === "Exhausted" && !results.length && <p className="text-14 text-secondary">No subtasks.</p>}
      {status === "CanLoadMore" && (
        <Button variant="secondary" onClick={() => loadMore(50)}>
          Load more subtasks
        </Button>
      )}
      {canWrite && (
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => setMode("create")}>
            Create subtask
          </Button>
          <Button variant="secondary" onClick={() => setMode("link")}>
            Link existing task
          </Button>
        </div>
      )}
      {canWrite && mode && <HierarchyForm key={mode} task={task} mode={mode} onDone={() => setMode(null)} />}
      {error && (
        <p role="alert" className="text-14 text-danger-primary">
          {error}
        </p>
      )}
    </section>
  );
}
function HierarchyForm({ task, mode, onDone }: { task: Task; mode: "parent" | "create" | "link"; onDone: () => void }) {
  const create = useMutation(api.tasks.index.create);
  const setParent = useMutation(api.tasks.hierarchy.setParent);
  const [snapshot] = useState(task);
  const [selected, setSelected] = useState<Task | null>(null);
  const [title, setTitle] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  return (
    <form
      className="space-y-3 border-t border-subtle-1 pt-4"
      onSubmit={async (event) => {
        event.preventDefault();
        setPending(true);
        setError("");
        try {
          if (mode === "create")
            await create({
              projectId: task.projectId,
              title,
              parent: { taskId: snapshot._id, expectedUpdatedAt: snapshot.updatedAt },
            });
          else if (selected)
            await setParent(
              mode === "parent"
                ? {
                    taskId: snapshot._id,
                    expectedUpdatedAt: snapshot.updatedAt,
                    parent: { taskId: selected._id, expectedUpdatedAt: selected.updatedAt },
                  }
                : {
                    taskId: selected._id,
                    expectedUpdatedAt: selected.updatedAt,
                    parent: { taskId: snapshot._id, expectedUpdatedAt: snapshot.updatedAt },
                  }
            );
          else return;
          onDone();
        } catch (failure) {
          setError(mutationMessage(failure));
        } finally {
          setPending(false);
        }
      }}
    >
      <fieldset disabled={pending} className="space-y-3">
        {mode === "create" ? (
          <SummonField label="Subtask title">
            <Input required maxLength={255} value={title} onChange={(event) => setTitle(event.target.value)} />
          </SummonField>
        ) : (
          <TaskChoice
            task={task}
            value={selected}
            onChange={setSelected}
            label={mode === "parent" ? "Parent task" : "Existing subtask"}
          />
        )}
        <div className="flex gap-2">
          <Button type="submit" loading={pending} disabled={mode !== "create" && !selected}>
            {mode === "create" ? "Create subtask" : "Save link"}
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
function Relationships({ task, canWrite }: { task: Task; canWrite: boolean }) {
  const relations = useQuery(api.tasks.relationships.list, { taskId: task._id });
  const remove = useMutation(api.tasks.relationships.remove);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState("");
  return (
    <section className="space-y-4 rounded-xl border border-subtle-1 p-4">
      <header className="flex flex-wrap justify-between gap-3">
        <h3 className="text-16 font-medium">Relationships</h3>
        {canWrite && (
          <Button variant="secondary" onClick={() => setAdding(true)}>
            Add relationship
          </Button>
        )}
      </header>
      <ul className="space-y-3">
        {relations?.map((item) => (
          <li className="space-y-1" key={item.relation._id}>
            <p className="text-12 text-secondary">{relationLabels[item.direction]}</p>
            <div className="flex flex-wrap items-center justify-between gap-2">
              {item.task ? (
                <TaskLink task={item.task} projectIdentifier={item.project.identifier} />
              ) : (
                <span className="text-14 text-secondary">Related task unavailable</span>
              )}
              {canWrite && item.canRemove && (
                <Button
                  variant="secondary"
                  onClick={() => {
                    void remove({
                      relationId: item.relation._id,
                      taskId: task._id,
                      expectedUpdatedAt: task.updatedAt,
                    }).catch((failure) => setError(mutationMessage(failure)));
                  }}
                >
                  Remove relationship
                </Button>
              )}
            </div>
          </li>
        ))}
      </ul>
      {relations?.length === 0 && <p className="text-14 text-secondary">No related tasks.</p>}
      {canWrite && adding && <RelationshipForm task={task} onDone={() => setAdding(false)} />}
      {error && (
        <p role="alert" className="text-14 text-danger-primary">
          {error}
        </p>
      )}
    </section>
  );
}
function RelationshipForm({ task, onDone }: { task: Task; onDone: () => void }) {
  const add = useMutation(api.tasks.relationships.add);
  const [snapshot] = useState(task);
  const [selected, setSelected] = useState<Task | null>(null);
  const projects = useQuery(api.projects.index.list, { workspaceId: task.workspaceId });
  const [projectId, setProjectId] = useState<Id<"projects"> | null>(task.projectId);
  const [kind, setKind] = useState<RelationDirection>("blocks");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  return (
    <form
      className="space-y-3 border-t border-subtle-1 pt-4"
      onSubmit={async (event) => {
        event.preventDefault();
        if (!selected) return;
        setPending(true);
        setError("");
        try {
          await add({
            taskId: snapshot._id,
            expectedUpdatedAt: snapshot.updatedAt,
            relatedTaskId: selected._id,
            expectedRelatedUpdatedAt: selected.updatedAt,
            kind,
          });
          onDone();
        } catch (failure) {
          setError(mutationMessage(failure));
        } finally {
          setPending(false);
        }
      }}
    >
      <fieldset disabled={pending} className="space-y-3">
        <SummonField label="Relationship" htmlFor="task-relation">
          <select
            id="task-relation"
            className={selectClass}
            value={kind}
            onChange={(event) => {
              const option = relationDirections.find((value) => value === event.target.value);
              if (option) setKind(option);
            }}
          >
            {relationDirections.map((direction) => (
              <option key={direction} value={direction}>
                {relationLabels[direction]}
              </option>
            ))}
          </select>
        </SummonField>
        <SummonField label="Related project" htmlFor="relation-project">
          <select
            id="relation-project"
            className={selectClass}
            value={projectId ?? ""}
            onChange={(event) => {
              const project = projects?.find((item) => item._id === event.target.value);
              if (project) {
                setProjectId(project._id);
                setSelected(null);
              }
            }}
          >
            <option value="">Choose a project</option>
            {projects
              ?.filter((item) => item.membershipRole !== "guest" && item.workspaceRole !== "guest")
              .map((project) => (
                <option key={project._id} value={project._id}>
                  {project.identifier} · {project.name}
                </option>
              ))}
          </select>
        </SummonField>
        {projectId && (
          <RelationCandidatesBoundary
            key={projectId}
            onFailure={() => setSelected(null)}
            onReset={() => {
              setSelected(null);
              setProjectId(null);
            }}
          >
            <TaskChoice
              task={task}
              projectId={projectId}
              value={selected}
              onChange={setSelected}
              label="Related task"
            />
          </RelationCandidatesBoundary>
        )}
        <div className="flex gap-2">
          <Button type="submit" loading={pending} disabled={!selected}>
            Add relationship
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
function TaskChoice({
  task,
  value,
  onChange,
  label,
  projectId = task.projectId,
}: {
  task: Task;
  projectId?: Id<"projects">;
  value: Task | null;
  onChange: (task: Task | null) => void;
  label: string;
}) {
  const { results, status, loadMore } = usePaginatedQuery(api.tasks.index.list, { projectId }, { initialNumItems: 50 });
  const fieldId = `choice-${label.replaceAll(" ", "-")}`;
  return (
    <div className="space-y-2">
      <SummonField label={label} htmlFor={fieldId}>
        <select
          id={fieldId}
          className={`${selectClass} max-w-full`}
          required
          value={value?._id ?? ""}
          onChange={(event) => onChange(results.find((item) => item._id === event.target.value) ?? null)}
        >
          <option value="">Select task</option>
          {results
            .filter((item) => item._id !== task._id)
            .map((item) => (
              <option key={item._id} value={item._id}>
                #{item.sequence} · {item.title}
              </option>
            ))}
        </select>
      </SummonField>
      {status === "CanLoadMore" && (
        <Button variant="secondary" onClick={() => loadMore(50)}>
          Load more tasks
        </Button>
      )}
    </div>
  );
}

class RelationCandidatesBoundary extends Component<
  { children: ReactNode; onFailure: () => void; onReset: () => void },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.onFailure();
  }
  render() {
    return this.state.failed ? (
      <div className="space-y-2">
        <p role="alert" className="text-14">
          Related tasks are unavailable. Your relationship choice is kept.
        </p>
        <Button variant="secondary" onClick={this.props.onReset}>
          Choose another project
        </Button>
      </div>
    ) : (
      this.props.children
    );
  }
}
