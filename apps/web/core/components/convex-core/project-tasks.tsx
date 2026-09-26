import { useState } from "react";
import { useSearchParams } from "react-router";
import { optimisticallyUpdateValueInPaginatedQuery, useMutation, usePaginatedQuery, useQuery } from "convex/react";
import { api } from "@summon/convex/api";
import type { FunctionReturnType } from "convex/server";
import { statusOptions } from "./tasks/options";
import { ProjectTaxonomy } from "./tasks/project-taxonomy";
import { TaskDetail } from "./tasks/task-detail";
import { Button } from "@plane/propel/button";
import { Input } from "@plane/propel/input";
import { SummonField } from "@/components/summon/forms";

export function ProjectTasks({ project }: { project: FunctionReturnType<typeof api.projects.index.list>[number] }) {
  const { results, status, loadMore } = usePaginatedQuery(
    api.tasks.index.list,
    { projectId: project._id },
    { initialNumItems: 50 }
  );
  const states = useQuery(api.tasks.states.list, { projectId: project._id });
  const canWrite = project.membershipRole !== "guest" && project.workspaceRole !== "guest";
  const create = useMutation(api.tasks.index.create);
  const setStatus = useMutation(api.tasks.index.setStatus).withOptimisticUpdate((store, args) => {
    optimisticallyUpdateValueInPaginatedQuery(store, api.tasks.index.list, { projectId: project._id }, (task) =>
      task._id === args.taskId && task.status !== args.status ? { ...task, status: args.status, stateId: null } : task
    );
  });
  const [params, setParams] = useSearchParams();
  const selected = params.get("task");
  const setSelected = (id: string | null) =>
    setParams((current) => {
      const next = new URLSearchParams(current);
      if (id) next.set("task", id);
      else next.delete("task");
      return next;
    });
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  if (selected) return <TaskDetail taskId={selected} project={project} onBack={() => setSelected(null)} />;
  return (
    <section aria-label="Tasks" className="space-y-5">
      {canWrite && project.membershipRole === "admin" && <ProjectTaxonomy projectId={project._id} />}
      {canWrite && (
        <form
          className="flex max-w-xl flex-col gap-3"
          onSubmit={async (event) => {
            event.preventDefault();
            setPending(true);
            setError("");
            try {
              await create({ projectId: project._id, title, description });
              setTitle("");
              setDescription("");
            } catch {
              setError("Could not create task. Check your access and try again.");
            } finally {
              setPending(false);
            }
          }}
        >
          <SummonField label="Task title">
            <Input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={255}
              required
              placeholder="What needs to be done?"
            />
          </SummonField>
          <SummonField label="Description">
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              maxLength={100000}
              rows={2}
              className="rounded-md border border-subtle-1 bg-layer-2 p-3 text-14"
            />
          </SummonField>
          <Button type="submit" loading={pending} className="self-start">
            Create task
          </Button>
        </form>
      )}
      {error && (
        <p role="alert" className="text-14 text-danger-primary">
          {error}
        </p>
      )}
      {status === "LoadingFirstPage" ? (
        <p role="status">Loading tasks…</p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-subtle-1">
          {results.length === 0 && (
            <p className="p-6 text-14 text-secondary">
              {canWrite ? "No tasks yet. Create the first task above." : "No tasks yet."}
            </p>
          )}
          <ul>
            {results.map((task) => (
              <li
                key={task._id}
                data-task-id={task._id}
                className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-subtle-1 px-4 py-3 last:border-b-0 md:grid-cols-[6rem_minmax(0,1fr)_auto]"
              >
                <span className="col-start-1 row-start-1 text-12 text-secondary">
                  {project.identifier}-{task.sequence}
                </span>
                <div className="col-span-2 col-start-1 row-start-2 min-w-0 md:col-span-1 md:col-start-2 md:row-start-1">
                  <button
                    type="button"
                    onClick={() => setSelected(task._id)}
                    className={
                      task.status === "done" ? "text-14 break-words text-secondary line-through" : "text-14 break-words"
                    }
                  >
                    {task.title}
                  </button>
                  {task.stateId && (
                    <p className="mt-1 text-12 text-secondary">
                      State: {states?.find((state) => state._id === task.stateId)?.name ?? "Loading state…"}
                    </p>
                  )}
                  {task.description && (
                    <p className="mt-1 line-clamp-2 text-12 break-words whitespace-pre-wrap text-secondary">
                      {task.description}
                    </p>
                  )}
                </div>
                <div className="col-start-2 row-start-1 space-y-1 md:col-start-3">
                  <label className="block text-12 text-secondary" htmlFor={`status-${task._id}`}>
                    Status group<span className="sr-only"> for {task.title}</span>
                  </label>
                  <select
                    id={`status-${task._id}`}
                    disabled={!canWrite}
                    value={task.status}
                    className="rounded-md border border-subtle-1 bg-layer-2 px-2 py-1 text-14"
                    onChange={(event) => {
                      const nextStatus = statusOptions.find((option) => option.value === event.target.value);
                      if (nextStatus) {
                        setError("");
                        void setStatus({ taskId: task._id, status: nextStatus.value }).catch(() =>
                          setError("The status could not be saved. Your previous status has been restored.")
                        );
                      }
                    }}
                  >
                    {statusOptions.map(({ value, label }) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
      {status !== "Exhausted" && status !== "LoadingFirstPage" && (
        <Button variant="secondary" loading={status === "LoadingMore"} onClick={() => loadMore(50)}>
          Load more tasks
        </Button>
      )}
    </section>
  );
}
