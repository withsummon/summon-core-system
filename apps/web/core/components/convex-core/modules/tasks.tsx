import { useState } from "react";
import { useMutation, usePaginatedQuery } from "convex/react";
import { usePaginatedQuery as useTaskPages } from "convex-helpers/react";
import { useSearchParams } from "react-router";
import { api } from "@summon/convex/api";
import type { Doc, Id } from "@summon/convex/data-model";
import type { FunctionReturnType } from "convex/server";
import { Button } from "@plane/propel/button";
import { SummonField } from "@/components/summon/forms";
import { mutationMessage } from "../commercial/forms";
type Module = FunctionReturnType<typeof api.modules.index.get>;
export function ModuleTasks({ module }: { module: Module }) {
  const tasks = usePaginatedQuery(api.modules.tasks.list, { moduleId: module._id }, { initialNumItems: 50 });
  const [assigning, setAssigning] = useState(false);
  const [, setParams] = useSearchParams();
  return (
    <section className="space-y-4">
      <header className="flex flex-wrap justify-between gap-2">
        <h3 className="text-20 font-medium">Tasks</h3>
        {module.canEdit && <Button onClick={() => setAssigning(true)}>Link task</Button>}
      </header>
      {assigning && module.canWrite && <LinkTask module={module} onClose={() => setAssigning(false)} />}
      <ul className="divide-y divide-subtle-1">
        {tasks.results.map((row) => (
          <li key={row.taskId} className="flex flex-wrap items-center justify-between gap-3 py-3">
            {row.task ? (
              <button
                className="max-w-full min-w-0 text-left text-14 break-words hover:text-accent-primary"
                onClick={() =>
                  setParams((current) => {
                    const next = new URLSearchParams(current);
                    next.set("projectView", "tasks");
                    next.delete("taskView");
                    next.delete("projectModule");
                    next.delete("comment");
                    next.set("task", row.taskId);
                    return next;
                  })
                }
              >
                {row.task.title}
              </button>
            ) : (
              <span className="text-14 text-secondary">Task unavailable</span>
            )}
            {module.canEdit && <RemoveTask taskId={row.taskId} updatedAt={row.updatedAt} module={module} />}
          </li>
        ))}
      </ul>
      {tasks.status === "LoadingFirstPage" && <p role="status">Loading module tasks…</p>}
      {tasks.status === "Exhausted" && !tasks.results.length && (
        <p className="text-14 text-secondary">No tasks assigned to this module.</p>
      )}
      {tasks.status === "CanLoadMore" && (
        <Button variant="secondary" onClick={() => tasks.loadMore(50)}>
          Load more module tasks
        </Button>
      )}
    </section>
  );
}
function LinkTask({ module, onClose }: { module: Module; onClose: () => void }) {
  const [initial] = useState(module);
  const tasks = useTaskPages(api.tasks.index.list, { projectId: module.projectId }, { initialNumItems: 50 });
  const [selected, setSelected] = useState<Doc<"tasks"> | null>(null);
  const assign = useMutation(api.modules.tasks.set);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  return (
    <form
      className="max-w-xl space-y-3 rounded-xl border border-subtle-1 p-4"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!selected) return;
        setPending(true);
        setError("");
        try {
          await assign({
            moduleId: initial._id,
            assigned: true,
            expectedModuleUpdatedAt: initial.updatedAt,
            taskId: selected._id,
            expectedTaskUpdatedAt: selected.updatedAt,
          });
          onClose();
        } catch (failure) {
          setError(mutationMessage(failure));
        } finally {
          setPending(false);
        }
      }}
    >
      <SummonField label="Task" htmlFor="module-task">
        <select
          id="module-task"
          required
          className="w-full rounded-md border border-subtle-1 bg-layer-2 p-2 text-14"
          value={selected?._id ?? ""}
          onChange={(e) => setSelected(tasks.results.find((task) => task._id === e.target.value) ?? null)}
        >
          <option value="">Choose task</option>
          {tasks.results.map((task) => (
            <option key={task._id} value={task._id}>
              {task.title}
            </option>
          ))}
        </select>
      </SummonField>
      <p className="text-12 text-secondary">Linking a task keeps its other module memberships unchanged.</p>
      {tasks.status === "CanLoadMore" && (
        <Button variant="secondary" onClick={() => tasks.loadMore(50)}>
          Load more project tasks
        </Button>
      )}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" loading={pending} disabled={!selected}>
          Confirm link
        </Button>
        <Button variant="secondary" disabled={pending} onClick={onClose}>
          Cancel
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-14 text-danger-primary">
          {error}
        </p>
      )}
    </form>
  );
}
function RemoveTask({ taskId, updatedAt, module }: { taskId: Id<"tasks">; updatedAt: number; module: Module }) {
  const remove = useMutation(api.modules.tasks.set);
  const [snapshot, setSnapshot] = useState<{ taskVersion: number; moduleVersion: number } | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  return (
    <div className="space-y-2">
      {snapshot ? (
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            loading={pending}
            onClick={async () => {
              setPending(true);
              setError("");
              try {
                await remove({
                  taskId,
                  moduleId: module._id,
                  assigned: false,
                  expectedTaskUpdatedAt: snapshot.taskVersion,
                  expectedModuleUpdatedAt: snapshot.moduleVersion,
                });
                setSnapshot(null);
              } catch (failure) {
                setError(mutationMessage(failure));
              } finally {
                setPending(false);
              }
            }}
          >
            Confirm removal
          </Button>
          <Button variant="secondary" disabled={pending} onClick={() => setSnapshot(null)}>
            Cancel
          </Button>
        </div>
      ) : (
        <Button
          variant="secondary"
          onClick={() => setSnapshot({ taskVersion: updatedAt, moduleVersion: module.updatedAt })}
        >
          Remove from module
        </Button>
      )}
      {error && (
        <p role="alert" className="text-12 text-danger-primary">
          {error}
        </p>
      )}
    </div>
  );
}
