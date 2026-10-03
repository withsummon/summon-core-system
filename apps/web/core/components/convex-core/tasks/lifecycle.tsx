import { useNavigate, useSearchParams } from "react-router";
import { PriorityIcon } from "@plane/propel/icons";
import { renderFormattedDate } from "@plane/utils";
import { IssueListBlockView } from "@/components/issues/issue-layouts/list/block";
import { IdentifierText } from "@/components/issues/issue-detail/identifier-text";
import { usePlatformOS } from "@/hooks/use-platform-os";
import { BulkLifecycle } from "./bulk-lifecycle";
import { useCallback, useContext, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useMutation, usePaginatedQuery } from "convex/react";
import type { FunctionArgs, FunctionReturnType } from "convex/server";
import { api } from "@summon/convex/api";
import { Button } from "@plane/propel/button";
import { Dialog, EDialogWidth } from "@plane/propel/dialog";
import { NativeTaskActionContext } from "@/app/native-workspace";
import { ContextMenu } from "@plane/propel/context-menu";
import { copyUrlToClipboard } from "@plane/utils";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
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
  const release = useReloadConfirmations(pending, "The work item operation is still in progress.", leave, pending);
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
  href,
  row,
}: {
  task: Task;
  disabled: boolean;
  lifecycle: ReturnType<typeof useTaskLifecycle>;
  children?: (Item: typeof Menu.MenuItem | typeof ContextMenu.Item) => ReactNode;
  href?: string;
  row?: (actions: ReactNode) => ReactNode;
}) {
  const openComposer = useContext(NativeTaskActionContext);
  const [copying, setCopying] = useState(false);
  const { confirmation, pending, error } = lifecycle;
  const available = {
    archive: task.canArchive,
    unarchive: task.canUnarchive,
    delete: task.canDelete,
    restore: task.canRestore,
  };
  const copyLink = async () => {
    if (!href || copying) return;
    setCopying(true);
    try {
      await copyUrlToClipboard(href);
      setToast({ type: TOAST_TYPE.SUCCESS, title: "Link copied", message: "Copied to clipboard." });
    } catch {
      setToast({ type: TOAST_TYPE.ERROR, title: "Could not copy the link" });
    } finally {
      setCopying(false);
    }
  };
  const items = (Item: typeof Menu.MenuItem | typeof ContextMenu.Item) => (
    <>
      {href && openComposer && task.canEdit && (
        <>
          <Item disabled={disabled || pending} onClick={() => openComposer(task._id, "edit")}>
            Edit
          </Item>
          <Item disabled={disabled || pending} onClick={() => openComposer(task._id, "copy")}>
            Make a copy
          </Item>
        </>
      )}
      {href && (
        <>
          <Item onClick={() => window.open(href, "_blank", "noopener,noreferrer")}>Open in new tab</Item>
          <Item disabled={copying} onClick={() => void copyLink()}>
            Copy link
          </Item>
        </>
      )}
      {children?.(Item)}
      {(task.canArchive || (href && task.canEdit)) && (
        <Item disabled={disabled || pending || !task.canArchive} onClick={() => lifecycle.choose(task, "archive")}>
          <span>
            Archive
            {!task.canArchive && (
              <span className="block text-11 text-secondary">Only completed or canceled work items</span>
            )}
          </span>
        </Item>
      )}
      {task.canUnarchive && (
        <Item disabled={disabled || pending} onClick={() => lifecycle.choose(task, "unarchive")}>
          Restore
        </Item>
      )}
      {task.canRestore && (
        <Item disabled={disabled || pending} onClick={() => lifecycle.choose(task, "restore")}>
          Restore
        </Item>
      )}
      {task.canDelete && (
        <Item
          disabled={disabled || pending}
          onClick={() => lifecycle.choose(task, "delete")}
          className="text-danger-primary"
        >
          Delete
        </Item>
      )}
    </>
  );
  const menu = (
    <Menu ellipsis placement="bottom-end" ariaLabel="Work item actions" disabled={pending}>
      {items(Menu.MenuItem)}
    </Menu>
  );
  if (!children && !href && !task.canArchive && !task.canUnarchive && !task.canRestore && !task.canDelete) return null;
  return (
    <>
      {row ? (
        <ContextMenu>
          <ContextMenu.Trigger className="contents">{row(menu)}</ContextMenu.Trigger>
          <ContextMenu.Portal>
            <ContextMenu.Content positionerClassName="z-[120]">{items(ContextMenu.Item)}</ContextMenu.Content>
          </ContextMenu.Portal>
        </ContextMenu>
      ) : (
        menu
      )}
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

export function ProjectIssueRow({
  task,
  identifier,
  identifierWidth,
  href,
  stateName,
  children,
}: {
  task: Task;
  identifier: string;
  identifierWidth: number;
  href: string;
  stateName: string;
  children?: (Item: typeof Menu.MenuItem | typeof ContextMenu.Item) => ReactNode;
}) {
  const rowRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const { isMobile } = usePlatformOS();
  const lifecycle = useTaskLifecycle(() => {});
  const peeked = params.get("peek") === identifier;
  return (
    <li>
      <TaskLifecycle
        task={task}
        href={href}
        disabled={false}
        lifecycle={lifecycle}
        row={(menu) => (
          <IssueListBlockView
            issueId={task._id}
            href={href}
            name={task.title}
            ariaLabel={`${identifier}: ${task.title}`}
            onOpen={() => {
              if (isMobile) navigate(href);
              else
                setParams((current) => {
                  const next = new URLSearchParams(current);
                  next.set("peek", identifier);
                  return next;
                });
            }}
            rowRef={rowRef}
            onDragStart={undefined}
            isPeeked={peeked}
            isPeekedAtCurrentLevel={peeked}
            isActive={false}
            isSelected={false}
            isDragging={false}
            disabled={false}
            pending={lifecycle.pending}
            identifier={<IdentifierText identifier={identifier} minWidth={identifierWidth} size="sm" />}
            indent={0}
            selection={null}
            expansion={null}
            properties={
              <>
                <span className="rounded-sm border border-subtle px-2 py-0.5 text-caption-sm-regular">{stateName}</span>
                <span className="inline-flex items-center gap-1 rounded-sm border border-subtle px-2 py-0.5 text-caption-sm-regular capitalize">
                  <PriorityIcon priority={task.priority} className="size-3.5" />
                  {task.priority}
                </span>
                {task.targetDate && (
                  <span className="text-caption-sm-regular text-secondary">{renderFormattedDate(task.targetDate)}</span>
                )}
              </>
            }
            actions={() => menu}
          />
        )}
      >
        {children}
      </TaskLifecycle>
    </li>
  );
}
