import { RecordVisit } from "../navigation/record-visit";
import { FavoriteToggle } from "../favorites/toggle";
import { lazy, Suspense, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@summon/convex/api";
import type { FunctionReturnType } from "convex/server";
import type { TNameDescriptionLoader } from "@plane/types";
import { Button } from "@plane/propel/button";
import { IssueTitleInput } from "@/components/issues/title-input";
import { NameDescriptionUpdateStatus, nameDescriptionStatus } from "@/components/issues/issue-update-status";
import useReloadConfirmations from "@/hooks/use-reload-confirmation";
import { TaskInlineProperties } from "./task-properties";
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
const TaskActivity = lazy(() => import("./activity/activity").then((module) => ({ default: module.TaskActivity })));
const TaskStructure = lazy(() => import("./task-structure").then((module) => ({ default: module.TaskStructure })));

type Project = FunctionReturnType<typeof api.projects.index.list>[number];
type Task = NonNullable<FunctionReturnType<typeof api.tasks.index.get>>;

export function TaskDetail({
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
  const [titleStatus, setTitleStatus] = useState<TNameDescriptionLoader>("saved");
  const [descriptionStatus, setDescriptionStatus] = useState<TNameDescriptionLoader>("saved");
  const status = nameDescriptionStatus(titleStatus, descriptionStatus);
  const hasUnsavedText = status === "submitting" || status === "failed";
  useReloadConfirmations(hasUnsavedText);
  const active = useQuery(api.tasks.index.get, recovery ? "skip" : { taskId });
  const recovered = useQuery(api.tasks.lifecycle.get, recovery ? { taskId, view: "deleted" } : "skip");
  const task = recovery ? recovered : active;
  const canWrite = task?.canEdit === true;
  if (task === undefined) return <p role="status">Opening task…</p>;
  if (task === null) return <TaskUnavailable onBack={onBack} />;
  if (task.projectId !== project._id) return <TaskUnavailable onBack={onBack} />;
  return (
    <article className="space-y-5">
      {task.deletedAt === null && (
        <RecordVisit workspaceId={task.workspaceId} target={{ type: "issue", id: task._id }} />
      )}
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
        </div>
      </header>
      {task.deletedAt !== null ? (
        <p className="text-14 text-secondary">
          This task is in Trash. Restore it to access its retained comments and links.
        </p>
      ) : (
        task.archivedAt !== null && <p className="text-14 text-secondary">Archived task · read only</p>
      )}
      <>
        <TaskTitle key={task._id} task={task} status={status} setStatus={setTitleStatus} />
        <TaskInlineProperties key={task._id} task={task} />
        {recovery ? (
          <p className="text-14 break-words whitespace-pre-wrap">{task.description}</p>
        ) : (
          <Suspense fallback={<p role="status">Loading task details…</p>}>
            <RichDescription taskId={task._id} canWrite={canWrite} setIsSubmitting={setDescriptionStatus} />
            <TaskStructure task={task} canWrite={canWrite} />
            <TaskAttachments key={`attachments:${task._id}`} taskId={task._id} />
            <TaskLinks key={`links:${task._id}`} taskId={task._id} />
            <TaskReactions key={`reactions:${task._id}`} taskId={task._id} />
            <TaskComments key={task._id} taskId={task._id} />
            <TaskActivity key={`activity:${task._id}`} taskId={task._id} />
          </Suspense>
        )}
      </>
      <TaskLifecycle task={task} disabled={hasUnsavedText} />
    </article>
  );
}
function TaskTitle({
  task,
  status,
  setStatus,
}: {
  task: Task;
  status: TNameDescriptionLoader;
  setStatus: (status: TNameDescriptionLoader) => void;
}) {
  const save = useMutation(api.tasks.index.setTitle);
  const submit = useMemo(() => {
    let expectedTitleUpdatedAt = task.titleUpdatedAt;
    return async (title: string) => {
      const result = await save({ taskId: task._id, expectedTitleUpdatedAt, title });
      expectedTitleUpdatedAt = result.titleUpdatedAt;
      return result.title;
    };
  }, [save, task._id, task.titleUpdatedAt]);
  return (
    <div className="space-y-2.5">
      <div className="flex justify-end">
        <NameDescriptionUpdateStatus isSubmitting={status} />
      </div>
      <IssueTitleInput
        value={task.title}
        onSubmit={submit}
        setIsSubmitting={setStatus}
        disabled={!task.canEdit}
        containerClassName="-ml-3"
      />
    </div>
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
