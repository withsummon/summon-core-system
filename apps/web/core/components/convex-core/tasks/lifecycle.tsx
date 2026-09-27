import { BulkLifecycle } from "./bulk-lifecycle";
import { useState } from "react";
import { useSearchParams } from "react-router";
import { useMutation, usePaginatedQuery } from "convex/react";
import type { FunctionArgs, FunctionReturnType } from "convex/server";
import { api } from "@summon/convex/api";
import { Button } from "@plane/propel/button";
import { mutationMessage } from "../commercial/forms";
type Task = FunctionReturnType<typeof api.tasks.index.get>;
type Project = FunctionReturnType<typeof api.projects.index.list>[number];
type Operation = FunctionArgs<typeof api.tasks.lifecycle.change>["operation"];
export function TaskLifecycle({ task }: { task: Task }) {
  const change = useMutation(api.tasks.lifecycle.change);
  const [, setParams] = useSearchParams();
  const [confirmation, setConfirmation] = useState<{ operation: Operation; expectedUpdatedAt: number } | null>(null);
  const [pending, setPending] = useState(false),
    [error, setError] = useState("");
  const choose = (operation: Operation) => {
    setError("");
    setConfirmation({ operation, expectedUpdatedAt: task.updatedAt });
  };
  return (
    <section className="space-y-3 border-t border-subtle-1 pt-4">
      {confirmation ? (
        <div className="space-y-3">
          <p className="text-14">
            {confirmation.operation === "delete"
              ? "Move this task to Trash? Its comments and links are retained, while ordinary views hide the task."
              : confirmation.operation === "restore"
                ? "Restore this task and its retained links? A previously archived task stays archived."
                : confirmation.operation === "archive"
                  ? "Archive this task? Its detail remains readable and editing is disabled until unarchived."
                  : "Unarchive this task and allow editing again?"}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              loading={pending}
              onClick={async () => {
                setPending(true);
                setError("");
                try {
                  await change({ taskId: task._id, ...confirmation });
                  setParams((current) => {
                    const next = new URLSearchParams(current);
                    next.delete("comment");
                    next.delete("task");
                    next.set("projectView", "tasks");
                    next.set("module", "projects");
                    if (confirmation.operation === "delete") next.set("taskView", "deleted");
                    else if (
                      confirmation.operation === "archive" ||
                      (confirmation.operation === "restore" && task.archivedAt !== null)
                    )
                      next.set("taskView", "archived");
                    else next.delete("taskView");
                    return next;
                  });
                } catch (failure) {
                  setError(mutationMessage(failure));
                } finally {
                  setPending(false);
                }
              }}
            >
              Confirm {confirmation.operation}
            </Button>
            <Button variant="secondary" disabled={pending} onClick={() => setConfirmation(null)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {task.canArchive && (
            <Button variant="secondary" onClick={() => choose("archive")}>
              Archive task
            </Button>
          )}
          {task.canUnarchive && (
            <Button variant="secondary" onClick={() => choose("unarchive")}>
              Unarchive task
            </Button>
          )}
          {task.canDelete && (
            <Button variant="secondary" onClick={() => choose("delete")}>
              Move task to Trash
            </Button>
          )}
          {task.canRestore && (
            <Button variant="secondary" onClick={() => choose("restore")}>
              Restore task
            </Button>
          )}
        </div>
      )}
      {error && (
        <p role="alert" className="text-14 text-danger-primary">
          {error}
        </p>
      )}
    </section>
  );
}
export function TaskRecoveryList({
  project,
  view,
  onSelect,
}: {
  project: Project;
  view: "archived" | "deleted";
  onSelect: (id: string) => void;
}) {
  const tasks = usePaginatedQuery(api.tasks.lifecycle.list, { projectId: project._id, view }, { initialNumItems: 50 });
  return (
    <section className="space-y-3">
      <h2 className="text-20 font-semibold">{view === "archived" ? "Archived tasks" : "Task trash"}</h2>
      <BulkLifecycle key={view} projectId={project._id} rows={tasks.results} view={view} />
      <ul className="divide-y divide-subtle-1">
        {tasks.results.map((task) => (
          <li key={task._id}>
            <button className="w-full space-y-1 py-3 text-left" onClick={() => onSelect(task._id)}>
              <span className="block text-12 text-secondary">
                {project.identifier}-{task.sequence}
              </span>
              <span className="block text-14 break-words">{task.title}</span>
            </button>
          </li>
        ))}
      </ul>
      {tasks.status === "LoadingFirstPage" && <p role="status">Loading tasks…</p>}
      {tasks.status === "Exhausted" && !tasks.results.length && (
        <p className="text-14 text-secondary">No tasks available in this view.</p>
      )}
      {tasks.status === "CanLoadMore" && (
        <Button variant="secondary" onClick={() => tasks.loadMore(50)}>
          Load more tasks
        </Button>
      )}
    </section>
  );
}
