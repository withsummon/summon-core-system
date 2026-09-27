import { useState } from "react";
import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
import { useSearchParams } from "react-router";
import { api } from "@summon/convex/api";
import type { Doc } from "@summon/convex/data-model";
import type { FunctionReturnType } from "convex/server";
import { Button } from "@plane/propel/button";
import { SummonField } from "@/components/summon/forms";
import { mutationMessage } from "../commercial/forms";
type Cycle = FunctionReturnType<typeof api.cycles.index.get>;
export function CycleTasks({ cycle }: { cycle: Cycle }) {
  const tasks = usePaginatedQuery(api.cycles.tasks.list, { cycleId: cycle._id }, { initialNumItems: 50 });
  const [assigning, setAssigning] = useState(false);
  const [, setParams] = useSearchParams();
  return (
    <section className="space-y-4">
      <header className="flex flex-wrap justify-between gap-2">
        <h3 className="text-20 font-medium">Tasks</h3>
        {cycle.canEdit && <Button onClick={() => setAssigning(true)}>Assign task</Button>}
      </header>
      {assigning && cycle.canWrite && <AssignTask cycle={cycle} onClose={() => setAssigning(false)} />}
      <ul className="divide-y divide-subtle-1">
        {tasks.results.map((task) => (
          <li key={task._id} className="flex flex-wrap items-center justify-between gap-3 py-3">
            <button
              className="max-w-full min-w-0 text-left text-14 break-words hover:text-accent-primary"
              onClick={() =>
                setParams((current) => {
                  const next = new URLSearchParams(current);
                  next.delete("projectView");
                  next.delete("cycle");
                  next.set("task", task._id);
                  return next;
                })
              }
            >
              {task.title}
            </button>
            {cycle.canEdit && <RemoveTask task={task} cycle={cycle} />}
          </li>
        ))}
      </ul>
      {tasks.status === "LoadingFirstPage" && <p role="status">Loading cycle tasks…</p>}
      {tasks.status === "Exhausted" && !tasks.results.length && (
        <p className="text-14 text-secondary">No tasks assigned to this cycle.</p>
      )}
      {tasks.status === "CanLoadMore" && (
        <Button variant="secondary" onClick={() => tasks.loadMore(50)}>
          Load more cycle tasks
        </Button>
      )}
    </section>
  );
}
function AssignTask({ cycle, onClose }: { cycle: Cycle; onClose: () => void }) {
  const [initial] = useState(cycle);
  const tasks = usePaginatedQuery(api.tasks.index.list, { projectId: cycle.projectId }, { initialNumItems: 50 });
  const [selected, setSelected] = useState<Doc<"tasks"> | null>(null);
  const current = useQuery(api.cycles.tasks.current, selected ? { taskId: selected._id } : "skip");
  const assign = useMutation(api.cycles.tasks.assign);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  return (
    <form
      className="max-w-xl space-y-3 rounded-xl border border-subtle-1 p-4"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!selected || current === undefined) return;
        setPending(true);
        setError("");
        try {
          await assign({
            cycleId: initial._id,
            expectedCycleUpdatedAt: initial.updatedAt,
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
      <SummonField label="Task" htmlFor="cycle-task">
        <select
          id="cycle-task"
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
      {selected && current === undefined && <p role="status">Loading current cycle membership…</p>}
      {current && (
        <p className="text-14 text-secondary">Currently in {current.name}. Assignment moves it to this cycle.</p>
      )}
      <p className="text-12 text-secondary">A cycle holds up to 100 tasks.</p>
      {tasks.status === "CanLoadMore" && (
        <Button variant="secondary" onClick={() => tasks.loadMore(50)}>
          Load more project tasks
        </Button>
      )}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" loading={pending} disabled={!selected || current === undefined}>
          Confirm assignment
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
function RemoveTask({ task, cycle }: { task: Doc<"tasks">; cycle: Cycle }) {
  const remove = useMutation(api.cycles.tasks.remove);
  const [snapshot, setSnapshot] = useState<{ taskVersion: number; cycleVersion: number } | null>(null);
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
                  taskId: task._id,
                  cycleId: cycle._id,
                  expectedTaskUpdatedAt: snapshot.taskVersion,
                  expectedCycleUpdatedAt: snapshot.cycleVersion,
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
          onClick={() => setSnapshot({ taskVersion: task.updatedAt, cycleVersion: cycle.updatedAt })}
        >
          Remove from cycle
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
