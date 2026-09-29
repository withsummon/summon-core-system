import { RecordVisit } from "../navigation/record-visit";
import { FavoriteToggle } from "../favorites/toggle";
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import type { ComponentProps, ReactNode } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { useMutation, useQuery } from "convex/react";
import { api } from "@summon/convex/api";
import type { Doc } from "@summon/convex/data-model";
import type { FunctionArgs, FunctionReturnType } from "convex/server";
import type { TNameDescriptionLoader } from "@plane/types";
import { Button } from "@plane/propel/button";
import { Dialog } from "@plane/propel/dialog";
import { Input } from "@plane/propel/input";
import { AlertModalCore, EModalPosition, EModalWidth, ModalCore, ToggleSwitch } from "@plane/ui";
import { mutationMessage } from "../commercial/forms";
import { IconButton } from "@plane/propel/icon-button";
import { CheckIcon, CloseIcon, CopyLinkIcon } from "@plane/propel/icons";
import { Menu } from "@plane/propel/menu";
import { useTranslation } from "@plane/i18n";
import { MoveDiagonal } from "lucide-react";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import { cn, copyUrlToClipboard } from "@plane/utils";
import { IssueTitleInput } from "@/components/issues/title-input";
import { NameDescriptionUpdateStatus, nameDescriptionStatus } from "@/components/issues/issue-update-status";
import useReloadConfirmations from "@/hooks/use-reload-confirmation";
import useSize from "@/hooks/use-window-size";
import { TaskInlineProperties, TaskProperties } from "./task-properties";
import { TaskLifecycle, useTaskLifecycle } from "./lifecycle";
import { TaskSubscription } from "../notifications/task-subscription";
import { peekOptions } from "./options";
import type { TaskPeekMode } from "./options";

const TaskRichEditor = lazy(() => import("./rich-editor").then((module) => ({ default: module.TaskRichEditor })));

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

export function CopyWorkItemLink({
  href,
  variant = "ghost",
  size = "base",
}: Pick<ComponentProps<typeof IconButton>, "variant" | "size"> & { href: string }) {
  const { t } = useTranslation();
  const [copying, setCopying] = useState(false);
  return (
    <IconButton
      icon={CopyLinkIcon}
      variant={variant}
      size={size}
      aria-label="Copy work item link"
      disabled={copying}
      onClick={async (event) => {
        event.preventDefault();
        event.stopPropagation();
        setCopying(true);
        try {
          await copyUrlToClipboard(href);
          setToast({
            type: TOAST_TYPE.SUCCESS,
            title: t("common.link_copied"),
            message: t("common.copied_to_clipboard"),
          });
        } catch {
          setToast({ type: TOAST_TYPE.ERROR, title: t("toast.error") });
        } finally {
          setCopying(false);
        }
      }}
    />
  );
}

const peekFrames = {
  "side-peek": "top-0! right-0! left-auto! h-dvh! w-full! max-h-none! max-w-none! translate-0! rounded-none! md:w-1/2!",
  modal: "h-[83.33dvh]! w-[83.33vw]! max-h-none! max-w-none!",
  "full-screen": "inset-4! h-[calc(100dvh-2rem)]! w-[calc(100vw-2rem)]! max-h-none! max-w-none! translate-0!",
} satisfies Record<TaskPeekMode, string>;

export function TaskPeek({ workspaceSlug }: { workspaceSlug: string }) {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const workItem = params.get("peek");
  const [mode, setMode] = useState<(typeof peekOptions)[number]>(peekOptions[0]);
  const address = useQuery(api.navigation.address.resolveTask, workItem ? { workspaceSlug, workItem } : "skip");
  const close = () =>
    setParams((current) => {
      const next = new URLSearchParams(current);
      next.delete("peek");
      return next;
    });
  const lifecycle = useTaskLifecycle((operation) => {
    if (operation === "delete" || operation === "archive") close();
  });
  const ModeIcon = mode.icon;
  return (
    <Dialog
      open={!!workItem}
      onOpenChange={(open, details) => {
        if (!open) {
          details.cancel();
          close();
        }
      }}
    >
      <Dialog.Panel
        className={cn("@container/task-peek overflow-hidden! data-[open]:animate-none!", peekFrames[mode.key])}
      >
        {address?.kind === "task" ? (
          <TaskDetailContent
            key={address.task._id}
            task={address.task}
            project={address.project}
            lifecyclePending={lifecycle.pending}
            propertyPlacement={mode.key === "full-screen" ? "sidebar" : "inline"}
            header={(hasUnsavedText) => (
              <header className="flex h-12 shrink-0 items-center justify-between gap-2 border-b border-subtle px-4">
                <div className="flex min-w-0 items-center gap-2">
                  <IconButton icon={CloseIcon} variant="ghost" aria-label="Close peek" onClick={close} />
                  <IconButton
                    icon={MoveDiagonal}
                    variant="ghost"
                    aria-label="Open work item in full screen"
                    onClick={() => navigate(`/${address.workspace.slug}/browse/${address.workItem}/`)}
                  />
                  <Menu ariaLabel="Peek layout" customButton={<ModeIcon className="size-4" />} noBorder>
                    {peekOptions.map((option) => (
                      <Menu.MenuItem key={option.key} onClick={() => setMode(option)}>
                        <option.icon className="size-4" />
                        {t(option.i18n_title)}
                        {mode.key === option.key && <CheckIcon className="ml-auto size-4" />}
                      </Menu.MenuItem>
                    ))}
                  </Menu>
                  <Dialog.Title className="min-w-0 truncate text-13">{address.workItem}</Dialog.Title>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <TaskSubscription taskId={address.task._id} />
                  <CopyWorkItemLink href={`/${address.workspace.slug}/browse/${address.workItem}/`} />
                  <TaskLifecycle task={address.task} disabled={hasUnsavedText} lifecycle={lifecycle}>
                    <Menu.MenuItem
                      onClick={() =>
                        window.open(
                          `/${address.workspace.slug}/browse/${address.workItem}/`,
                          "_blank",
                          "noopener,noreferrer"
                        )
                      }
                    >
                      Open in new tab
                    </Menu.MenuItem>
                  </TaskLifecycle>
                </div>
              </header>
            )}
          />
        ) : workItem ? (
          <div className="space-y-4 p-5">
            <Dialog.Title>Work item</Dialog.Title>
            {address === undefined ? (
              <p role="status">Opening work item…</p>
            ) : (
              <p role="alert">
                This work item is unavailable. It may have been removed or your access may have changed.
              </p>
            )}
            <Button variant="secondary" onClick={close}>
              Close peek
            </Button>
          </div>
        ) : null}
      </Dialog.Panel>
    </Dialog>
  );
}

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
  propertyPlacement = "sidebar",
}: {
  task: Task;
  project: Project;
  header: (hasUnsavedText: boolean) => ReactNode;
  lifecyclePending: boolean;
  propertyPlacement?: "sidebar" | "inline";
}) {
  const [width] = useSize();
  const inlineProperties = propertyPlacement === "inline" || width < 768;
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
                <TaskReactions taskId={task._id} />
                <TaskStructure task={task} canWrite={task.canEdit && !lifecyclePending} />
                <TaskAttachments taskId={task._id} />
                <TaskLinks taskId={task._id} />
                {inlineProperties && <TaskInlineProperties task={task} disabled={lifecyclePending} />}
                <TaskComments taskId={task._id} />
                <TaskActivity taskId={task._id} />
              </Suspense>
            )}
          </fieldset>
        </main>
        {!inlineProperties && (
          <aside
            aria-label="Task properties"
            className="hidden h-full min-w-[300px] shrink-0 overflow-y-auto border-l border-subtle bg-surface-1 p-4 md:block md:w-80"
          >
            <TaskInlineProperties task={task} disabled={lifecyclePending} />
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

export function CreateProjectIssue({
  address,
  states,
  onClose,
}: {
  address: FunctionReturnType<typeof api.navigation.address.resolveProjectId>;
  states: FunctionReturnType<typeof api.tasks.states.list>;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const create = useMutation(api.tasks.index.create);
  const defaultState = states.find((state) => state.isDefault);
  const {
    register,
    watch,
    setValue,
    handleSubmit,
    reset,
    clearErrors,
    setError,
    formState: { isDirty, isSubmitting, errors },
  } = useForm<Required<Pick<FunctionArgs<typeof api.tasks.index.create>, "title" | "html" | "status" | "properties">>>({
    defaultValues: {
      title: "",
      html: "<p></p>",
      status: defaultState?.status ?? "todo",
      properties: {
        stateId: defaultState?._id ?? null,
        priority: "none",
        estimatePointId: null,
        assigneeIds: [],
        labelIds: [],
        startDate: null,
        targetDate: null,
      },
    },
  });
  const [createMore, setCreateMore] = useState(false);
  const [discarding, setDiscarding] = useState(false);
  const continuation = useRef<(() => void) | null>(null);
  const leave = useCallback(() => {
    continuation.current = null;
    onClose();
  }, [onClose]);
  const release = useReloadConfirmations(isDirty || isSubmitting, "This work item has unsaved changes.", leave);
  useEffect(
    () => () => {
      continuation.current = null;
    },
    []
  );
  const dismiss = () => {
    if (isSubmitting) return;
    if (isDirty) setDiscarding(true);
    else onClose();
  };
  return (
    <ModalCore
      isOpen
      handleClose={dismiss}
      position={EModalPosition.TOP}
      width={EModalWidth.XXXXL}
      className="rounded-lg !bg-transparent shadow-none"
    >
      <form
        className="flex w-full flex-col rounded-lg bg-surface-1"
        aria-busy={isSubmitting}
        onSubmit={handleSubmit(async (values) => {
          continuation.current = () => {
            if (createMore) reset();
            else onClose();
          };
          clearErrors("root");
          let taskId: FunctionReturnType<typeof api.tasks.index.create>;
          try {
            taskId = await create({ projectId: address.project._id, ...values });
          } catch (failure) {
            if (continuation.current !== null) setError("root", { type: "server", message: mutationMessage(failure) });
            continuation.current = null;
            return;
          }
          release((allow) => {
            const complete = continuation.current;
            continuation.current = null;
            complete?.();
            if (allow && complete && !createMore)
              navigate(`/${address.workspace.slug}/projects/${address.project._id}/issues/${taskId}/`);
          });
        })}
      >
        <div className="p-5">
          <Dialog.Title className="pb-2 text-h4-medium text-secondary">{t("create_new_issue")}</Dialog.Title>
          <p className="pt-2 pb-4 text-body-sm-medium text-secondary">{address.project.name}</p>
          <label className="sr-only" htmlFor="new-work-item-title">
            {t("title")}
          </label>
          <Input
            id="new-work-item-title"
            className="w-full"
            {...register("title")}
            required
            maxLength={255}
            placeholder={t("title")}
            disabled={isSubmitting}
          />
        </div>
        <div className="px-5 pb-4">
          <Suspense fallback={<p role="status">Loading work item editor…</p>}>
            <TaskRichEditor
              id={`create-work-item-${address.project._id}`}
              label="Work item description"
              placeholder={t("description")}
              html="<p></p>"
              value={watch("html")}
              editable={!isSubmitting}
              onChange={(html) => setValue("html", html, { shouldDirty: true })}
            />
          </Suspense>
        </div>
        <fieldset disabled={isSubmitting} className="border-t border-subtle px-5 py-3">
          <TaskProperties
            projectId={address.project._id}
            draft={{ ...watch("properties"), status: watch("status") }}
            onChange={({ status, ...properties }) => {
              setValue("status", status, { shouldDirty: true });
              setValue("properties", properties, { shouldDirty: true });
            }}
          />
        </fieldset>
        {errors.root && (
          <p role="alert" className="px-5 text-14 text-danger-primary">
            {errors.root.message}
          </p>
        )}
        <div className="flex flex-wrap items-center justify-end gap-4 border-t border-subtle px-4 py-3">
          <label className="inline-flex items-center gap-1.5 text-caption-sm-regular">
            <ToggleSwitch
              value={createMore}
              onChange={setCreateMore}
              label={t("create_more")}
              size="sm"
              disabled={isSubmitting}
            />
            {t("create_more")}
          </label>
          <Button variant="secondary" size="lg" type="button" disabled={isSubmitting} onClick={dismiss}>
            {t("discard")}
          </Button>
          <Button size="lg" type="submit" loading={isSubmitting} disabled={isSubmitting}>
            {isSubmitting ? t("saving") : t("save")}
          </Button>
        </div>
      </form>
      {discarding && (
        <AlertModalCore
          isSubmitting={false}
          isOpen
          handleClose={() => setDiscarding(false)}
          handleSubmit={leave}
          variant="primary"
          title="Discard this work item?"
          content="Your unsaved work item changes will be lost."
          primaryButtonText={{ default: t("discard"), loading: t("discard") }}
          secondaryButtonText={t("cancel")}
        />
      )}
    </ModalCore>
  );
}
