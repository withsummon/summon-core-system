import { useState } from "react";
import { usePaginatedQuery, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "@summon/convex/api";
import { Button } from "@plane/propel/button";
import { TaskRichEditor } from "../tasks/rich-editor";
type Project = FunctionReturnType<typeof api.navigation.address.resolveProjectId>["project"];
type Removed = FunctionReturnType<typeof api.intakes.lifecycle.get>;
export function IntakeTrash({
  project,
  selected,
  onSelect,
  pending,
  onRestore,
}: {
  project: Project;
  selected: string | null;
  onSelect: (id: Removed["task"]["_id"] | null) => void;
  pending: boolean;
  onRestore: (snapshot: Removed) => void;
}) {
  const rows = usePaginatedQuery(api.intakes.lifecycle.list, selected ? "skip" : { projectId: project._id }, {
    initialNumItems: 30,
  });
  if (selected)
    return (
      <RemovedSubmission
        project={project}
        taskId={selected}
        onBack={() => onSelect(null)}
        pending={pending}
        onRestore={onRestore}
      />
    );
  return (
    <section className="space-y-4">
      <h2 className="text-24 font-semibold">Intake trash</h2>
      <p className="text-14 text-secondary">Removed submissions you can recover.</p>
      <ul className="divide-y divide-subtle-1">
        {rows.results.map(({ task }) => (
          <li key={task._id}>
            <button className="w-full py-4 text-left" onClick={() => onSelect(task._id)}>
              <span className="text-12 text-secondary">
                {project.identifier}-{task.sequence}
              </span>
              <span className="block text-16 font-medium break-words">{task.title}</span>
            </button>
          </li>
        ))}
      </ul>
      {rows.status === "LoadingFirstPage" && <p role="status">Loading removed submissions…</p>}
      {rows.status === "Exhausted" && rows.results.length === 0 && (
        <p className="text-14 text-secondary">No removed submissions available.</p>
      )}
      {rows.status === "CanLoadMore" && (
        <Button variant="secondary" onClick={() => rows.loadMore(30)}>
          Load more removed submissions
        </Button>
      )}
    </section>
  );
}
function RemovedSubmission({
  project,
  taskId,
  onBack,
  pending,
  onRestore,
}: {
  project: Project;
  taskId: string;
  onBack: () => void;
  pending: boolean;
  onRestore: (snapshot: Removed) => void;
}) {
  const detail = useQuery(api.intakes.lifecycle.get, { taskId, projectId: project._id });
  const [snapshot, setSnapshot] = useState<Removed | null>(null);
  if (!detail) return <p role="status">Opening removed submission…</p>;
  return (
    <article className="space-y-4">
      <Button variant="secondary" onClick={onBack}>
        Back to intake trash
      </Button>
      <div>
        <p className="text-12 text-secondary">
          {project.identifier}-{detail.task.sequence} · Removed
        </p>
        <h2 className="text-24 font-semibold break-words">{detail.task.title}</h2>
      </div>
      {detail.task.description.trim() && (
        <TaskRichEditor
          id={`removed-intake-${taskId}`}
          label="Removed submission description"
          placeholder="Submission description"
          html={detail.html}
          editable={false}
        />
      )}
      {detail.restoreBlockedReason && (
        <p role="status" className="text-14 text-secondary">
          {detail.restoreBlockedReason}
        </p>
      )}
      {detail.canRestore &&
        (snapshot ? (
          <section className="space-y-3">
            <p className="text-14">
              {snapshot.restoresTask
                ? "Restore this submission and the task hidden by its removal?"
                : "Restore this intake entry? The project task’s current archive or deletion state will remain unchanged."}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button loading={pending} onClick={() => onRestore(snapshot)}>
                Confirm restore
              </Button>
              <Button variant="secondary" disabled={pending} onClick={() => setSnapshot(null)}>
                Cancel
              </Button>
            </div>
          </section>
        ) : (
          <Button disabled={pending} onClick={() => setSnapshot(detail)}>
            Restore submission
          </Button>
        ))}
    </article>
  );
}
