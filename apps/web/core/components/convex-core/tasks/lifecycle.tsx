import { BulkLifecycle } from "./bulk-lifecycle";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useMutation, usePaginatedQuery } from "convex/react";
import type { FunctionArgs, FunctionReturnType } from "convex/server";
import { api } from "@summon/convex/api";
import { Button } from "@plane/propel/button";
import { Dialog, EDialogWidth } from "@plane/propel/dialog";
import { Menu } from "@plane/propel/menu";
import useReloadConfirmations from "@/hooks/use-reload-confirmation";
import { mutationMessage } from "../commercial/forms";
type Task = NonNullable<FunctionReturnType<typeof api.tasks.index.get>>;
type Project = FunctionReturnType<typeof api.projects.index.list>[number];
type Operation = FunctionArgs<typeof api.tasks.lifecycle.change>["operation"];
const lifecycleLabels = {
  archive: {
    title: "Archive work item",
    description: "Archive this work item? Its detail remains readable and editing is disabled until unarchived.",
    action: "Archive",
  },
  unarchive: {
    title: "Restore work item",
    description: "Unarchive this work item and allow editing again?",
    action: "Restore",
  },
  delete: {
    title: "Delete work item",
    description: "Move this work item to Trash? Its comments and links are retained, while ordinary views hide it.",
    action: "Delete",
  },
  restore: {
    title: "Restore work item",
    description: "Restore this work item and its retained links? A previously archived work item stays archived.",
    action: "Restore",
  },
} satisfies Record<Operation, { title: string; description: string; action: string }>;

export function useTaskLifecycle(onSuccess: (operation: Operation, task: Task) => void) {
  const change = useMutation(api.tasks.lifecycle.change);
  const [confirmation, setConfirmation] = useState<{ operation: Operation; task: Task } | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const continuation = useRef<(() => void) | null>(null);
  const leave = useCallback(() => {
    continuation.current = null;
    setConfirmation(null);
  }, []);
  const release = useReloadConfirmations(pending, "The work item operation is still in progress.", leave);
  useEffect(
    () => () => {
      continuation.current = null;
    },
    []
  );
  return {
    confirmation,
    pending,
    error,
    choose(task: Task, operation: Operation) {
      setError("");
      setConfirmation({ operation, task });
    },
    cancel() {
      if (!pending) setConfirmation(null);
    },
    async confirm() {
      if (!confirmation || pending) return;
      const { task, operation } = confirmation;
      continuation.current = () => onSuccess(operation, task);
      setPending(true);
      setError("");
      try {
        await change({ taskId: task._id, operation, expectedUpdatedAt: task.updatedAt });
      } catch (failure) {
        if (continuation.current !== null) setError(mutationMessage(failure));
        continuation.current = null;
        return;
      } finally {
        setPending(false);
      }
      release((allow) => {
        const navigate = continuation.current;
        continuation.current = null;
        if (allow) navigate?.();
      });
      setConfirmation(null);
    },
  };
}

export function TaskLifecycle({
  task,
  disabled,
  lifecycle,
  children,
}: {
  task: Task;
  disabled: boolean;
  lifecycle: ReturnType<typeof useTaskLifecycle>;
  children?: ReactNode;
}) {
  const { confirmation, pending, error } = lifecycle;
  const available = {
    archive: task.canArchive,
    unarchive: task.canUnarchive,
    delete: task.canDelete,
    restore: task.canRestore,
  };
  if (!children && !task.canArchive && !task.canUnarchive && !task.canRestore && !task.canDelete) return null;
  return (
    <>
      <Menu ellipsis placement="bottom-end" ariaLabel="Work item actions" disabled={pending}>
        {children}
        {task.canArchive && (
          <Menu.MenuItem disabled={disabled} onClick={() => lifecycle.choose(task, "archive")}>
            Archive
          </Menu.MenuItem>
        )}
        {task.canUnarchive && (
          <Menu.MenuItem disabled={disabled} onClick={() => lifecycle.choose(task, "unarchive")}>
            Restore
          </Menu.MenuItem>
        )}
        {task.canRestore && (
          <Menu.MenuItem disabled={disabled} onClick={() => lifecycle.choose(task, "restore")}>
            Restore
          </Menu.MenuItem>
        )}
        {task.canDelete && (
          <Menu.MenuItem
            disabled={disabled}
            onClick={() => lifecycle.choose(task, "delete")}
            className="text-danger-primary"
          >
            Delete
          </Menu.MenuItem>
        )}
      </Menu>
      {confirmation && confirmation.task._id === task._id && (
        <Dialog
          open
          onOpenChange={(open) => {
            if (!open) lifecycle.cancel();
          }}
        >
          <Dialog.Panel width={EDialogWidth.XL}>
            <div className="space-y-5 p-5">
              <Dialog.Title>{lifecycleLabels[confirmation.operation].title}</Dialog.Title>
              <Dialog.Description className="text-14 text-secondary">
                {lifecycleLabels[confirmation.operation].description}
              </Dialog.Description>
              {error && (
                <p role="alert" className="text-14 text-danger-primary">
                  {error}
                </p>
              )}
              <div className="flex justify-end gap-3">
                <Button variant="secondary" disabled={pending} onClick={lifecycle.cancel}>
                  Cancel
                </Button>
                <Button
                  loading={pending}
                  disabled={disabled || pending || !available[confirmation.operation]}
                  onClick={() => void lifecycle.confirm()}
                >
                  {pending ? "Saving…" : lifecycleLabels[confirmation.operation].action}
                </Button>
              </div>
            </div>
          </Dialog.Panel>
        </Dialog>
      )}
    </>
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
