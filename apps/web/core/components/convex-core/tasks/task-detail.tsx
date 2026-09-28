import { RecordVisit } from "../navigation/record-visit";
import { FavoriteToggle } from "../favorites/toggle";
import { lazy, Suspense, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useSearchParams } from "react-router";
import { useMutation, useQuery } from "convex/react";
import { api } from "@summon/convex/api";
import type { Doc } from "@summon/convex/data-model";
import type { FunctionReturnType } from "convex/server";
import type { TNameDescriptionLoader } from "@plane/types";
import { Button } from "@plane/propel/button";
import { IssueTitleInput } from "@/components/issues/title-input";
import { NameDescriptionUpdateStatus, nameDescriptionStatus } from "@/components/issues/issue-update-status";
import useReloadConfirmations from "@/hooks/use-reload-confirmation";
import useSize from "@/hooks/use-window-size";
import { TaskInlineProperties } from "./task-properties";
import { TaskLifecycle, useTaskLifecycle } from "./lifecycle";
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

type Project = Doc<"projects">;
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
  const [, setParams] = useSearchParams();
  const active = useQuery(api.tasks.index.get, recovery ? "skip" : { taskId });
  const recovered = useQuery(api.tasks.lifecycle.get, recovery ? { taskId, view: "deleted" } : "skip");
  const task = recovery ? recovered : active;
  const lifecycle = useTaskLifecycle((operation, snapshot) => {
    setParams((current) => {
      const next = new URLSearchParams(current);
      next.delete("comment");
      next.delete("task");
      next.set("projectView", "tasks");
      next.set("module", "projects");
      if (operation === "delete") next.set("taskView", "deleted");
      else if (operation === "archive" || (operation === "restore" && snapshot.archivedAt !== null))
        next.set("taskView", "archived");
      else next.delete("taskView");
      return next;
    });
  });
  if (task === undefined) return <p role="status">Opening task…</p>;
  if (task === null) return <TaskUnavailable onBack={onBack} />;
  if (task.projectId !== project._id) return <TaskUnavailable onBack={onBack} />;
  return (
    <TaskDetailContent
      key={task._id}
      task={task}
      project={project}
      lifecyclePending={lifecycle.pending}
      header={(hasUnsavedText) => (
        <header className="flex flex-wrap justify-between gap-3 border-b border-subtle p-4">
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
            <TaskLifecycle task={task} disabled={hasUnsavedText} lifecycle={lifecycle} />
          </div>
        </header>
      )}
    />
  );
}

export function TaskDetailContent({
  task,
  project,
  header,
  lifecyclePending,
}: {
  task: Task;
  project: Project;
  header: (hasUnsavedText: boolean) => ReactNode;
  lifecyclePending: boolean;
}) {
  const [width] = useSize();
  const [titleStatus, setTitleStatus] = useState<TNameDescriptionLoader>("saved");
  const [descriptionStatus, setDescriptionStatus] = useState<TNameDescriptionLoader>("saved");
  const status = nameDescriptionStatus(titleStatus, descriptionStatus);
  const hasUnsavedText = status === "submitting" || status === "failed";
  useReloadConfirmations(hasUnsavedText);
  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      {task.deletedAt === null && (
        <RecordVisit workspaceId={task.workspaceId} target={{ type: "issue", id: task._id }} />
      )}
      {header(hasUnsavedText)}
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <main className="h-full min-w-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6 lg:px-10">
          <fieldset disabled={lifecyclePending} className="mx-auto max-w-4xl min-w-0 space-y-6">
            {task.deletedAt !== null ? (
              <p className="text-14 text-secondary">
                This task is in Trash. Restore it to access its retained comments and links.
              </p>
            ) : (
              task.archivedAt !== null && <p className="text-14 text-secondary">Archived task · read only</p>
            )}
            <TaskTitle
              key={task._id}
              task={task}
              project={project}
              status={status}
              setStatus={setTitleStatus}
              disabled={lifecyclePending}
            />
            {task.deletedAt !== null ? (
              <p className="text-14 break-words whitespace-pre-wrap">{task.description}</p>
            ) : (
              <Suspense fallback={<p role="status">Loading task details…</p>}>
                <RichDescription
                  taskId={task._id}
                  canWrite={task.canEdit && !lifecyclePending}
                  setIsSubmitting={setDescriptionStatus}
                />
                <TaskReactions key={`reactions:${task._id}`} taskId={task._id} />
                <TaskStructure task={task} canWrite={task.canEdit && !lifecyclePending} />
                <TaskAttachments key={`attachments:${task._id}`} taskId={task._id} />
                <TaskLinks key={`links:${task._id}`} taskId={task._id} />
                {width < 768 && <TaskInlineProperties key={task._id} task={task} disabled={lifecyclePending} />}
                <TaskComments key={task._id} taskId={task._id} />
                <TaskActivity key={`activity:${task._id}`} taskId={task._id} />
              </Suspense>
            )}
          </fieldset>
        </main>
        {width >= 768 && (
          <aside
            aria-label="Task properties"
            className="hidden h-full min-w-[300px] shrink-0 overflow-y-auto border-l border-subtle bg-surface-1 p-4 md:block md:w-80"
          >
            <TaskInlineProperties key={task._id} task={task} disabled={lifecyclePending} />
          </aside>
        )}
      </div>
    </div>
  );
}
function TaskTitle({
  task,
  project,
  status,
  setStatus,
  disabled,
}: {
  task: Task;
  project: Project;
  status: TNameDescriptionLoader;
  setStatus: (status: TNameDescriptionLoader) => void;
  disabled: boolean;
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
      <div className="flex items-center justify-between gap-4">
        <span className="text-13 text-secondary">
          {project.identifier}-{task.sequence}
        </span>
        <NameDescriptionUpdateStatus isSubmitting={status} />
      </div>
      <IssueTitleInput
        value={task.title}
        onSubmit={submit}
        setIsSubmitting={setStatus}
        disabled={!task.canEdit || disabled}
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
