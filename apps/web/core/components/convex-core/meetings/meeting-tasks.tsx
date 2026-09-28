import { useId, useState } from "react";
import { useMutation, usePaginatedQuery } from "convex/react";
import { usePaginatedQuery as useTaskPages } from "convex-helpers/react";
import type { FunctionReturnType } from "convex/server";
import type { Id } from "@summon/convex/data-model";
import { api } from "@summon/convex/api";
import { Button } from "@plane/propel/button";
import { SummonField } from "@/components/summon/forms";

type Meeting = FunctionReturnType<typeof api.meetings.index.get>;
type Projects = FunctionReturnType<typeof api.projects.index.list>;
export function MeetingTasks({
  workspaceId,
  meeting,
  projects,
  canWrite,
}: {
  workspaceId: Id<"workspaces">;
  meeting: Meeting;
  projects: Projects;
  canWrite: boolean;
}) {
  const { results, status, loadMore } = usePaginatedQuery(
    api.meetings.tasks.list,
    { workspaceId, meetingId: meeting._id },
    { initialNumItems: 50 }
  );
  const unlink = useMutation(api.meetings.tasks.unlink);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  return (
    <section className="space-y-3">
      <h2 className="font-semibold">Linked tasks</h2>
      <ul className="space-y-2">
        {results.map(({ linkId, task }) => (
          <li key={linkId} className="flex items-center justify-between gap-3 rounded border border-subtle-1 p-3">
            <div>
              <p>{task ? task.title : "Linked task unavailable"}</p>
              {task && (
                <p className="text-14 text-secondary">
                  {task.status.replaceAll("_", " ")}
                  {task.archivedAt !== null ? " · archived" : ""}
                </p>
              )}
            </div>
            {canWrite && (
              <Button
                variant="secondary"
                disabled={pending}
                onClick={() => {
                  setPending(true);
                  setError("");
                  void unlink({ workspaceId, meetingId: meeting._id, linkId })
                    .catch(() => setError("Could not unlink task. Check your current access."))
                    .finally(() => setPending(false));
                }}
              >
                Unlink task
              </Button>
            )}
          </li>
        ))}
      </ul>
      {status === "Exhausted" && results.length === 0 && <p className="text-secondary">No linked tasks.</p>}
      {status === "CanLoadMore" && (
        <Button variant="secondary" onClick={() => loadMore(50)}>
          Load more linked tasks
        </Button>
      )}
      {error && (
        <p role="alert" className="text-danger-primary">
          {error}
        </p>
      )}
      {canWrite && (
        <LinkTask
          key={`${meeting._id}:${meeting.projectId ?? "workspace"}`}
          workspaceId={workspaceId}
          meeting={meeting}
          projects={projects}
        />
      )}
    </section>
  );
}
function LinkTask({
  workspaceId,
  meeting,
  projects,
}: {
  workspaceId: Id<"workspaces">;
  meeting: Meeting;
  projects: Projects;
}) {
  const [selectedProject, setSelectedProject] = useState<Id<"projects"> | null>(meeting.projectId);
  const projectId = useId();
  return (
    <div className="space-y-3 rounded border border-subtle-1 p-4">
      {!meeting.projectId && (
        <SummonField label="Task project" htmlFor={projectId}>
          <select
            id={projectId}
            className="rounded border border-subtle-1 bg-layer-1 p-2 text-primary"
            value={selectedProject ?? ""}
            onChange={(event) =>
              setSelectedProject(projects.find((project) => project._id === event.target.value)?._id ?? null)
            }
          >
            <option value="">Choose a project</option>
            {projects
              .filter((project) => project.membershipRole !== "guest")
              .map((project) => (
                <option key={project._id} value={project._id}>
                  {project.name}
                </option>
              ))}
          </select>
        </SummonField>
      )}
      {selectedProject && (
        <TaskPicker
          key={selectedProject}
          workspaceId={workspaceId}
          meetingId={meeting._id}
          projectId={selectedProject}
        />
      )}
    </div>
  );
}
function TaskPicker({
  workspaceId,
  meetingId,
  projectId,
}: {
  workspaceId: Id<"workspaces">;
  meetingId: Id<"meetings">;
  projectId: Id<"projects">;
}) {
  const { results, status, loadMore } = useTaskPages(api.tasks.index.list, { projectId }, { initialNumItems: 50 });
  const [taskId, setTaskId] = useState<Id<"tasks"> | null>(null);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const link = useMutation(api.meetings.tasks.link);
  const selectId = useId();
  return (
    <form
      className="space-y-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (!taskId) return;
        setPending(true);
        setError("");
        void link({ workspaceId, meetingId, taskId })
          .then(() => setTaskId(null))
          .catch(() => setError("Could not link task. It may already be linked or access has changed."))
          .finally(() => setPending(false));
      }}
    >
      <SummonField label="Existing task" htmlFor={selectId}>
        <select
          id={selectId}
          required
          disabled={pending}
          className="rounded border border-subtle-1 bg-layer-1 p-2 text-primary"
          value={taskId ?? ""}
          onChange={(event) => setTaskId(results.find((task) => task._id === event.target.value)?._id ?? null)}
        >
          <option value="">Choose a task</option>
          {results.map((task) => (
            <option key={task._id} value={task._id}>
              {task.title}
            </option>
          ))}
        </select>
      </SummonField>
      {status === "CanLoadMore" && (
        <Button type="button" variant="secondary" onClick={() => loadMore(50)}>
          Load more tasks
        </Button>
      )}
      {error && (
        <p role="alert" className="text-danger-primary">
          {error}
        </p>
      )}
      <Button type="submit" disabled={pending || !taskId}>
        Link existing task
      </Button>
    </form>
  );
}
