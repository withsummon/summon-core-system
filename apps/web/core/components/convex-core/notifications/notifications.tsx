import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { useMutation, useQuery } from "convex/react";
import { usePaginatedQuery } from "convex-helpers/react";
import type { FunctionArgs, FunctionReturnType } from "convex/server";
import { api } from "@summon/convex/api";
import {
  ENotificationTab,
  FILTER_TYPE_OPTIONS,
  NOTIFICATION_TABS,
  NOTIFICATION_SNOOZE_OPTIONS,
} from "@plane/constants";
import { useTranslation } from "@plane/i18n";
import { Button } from "@plane/propel/button";
import { Dialog } from "@plane/propel/dialog";
import { EmptyStateCompact } from "@plane/propel/empty-state";
import { IconButton } from "@plane/propel/icon-button";
import { InboxIcon } from "@plane/propel/icons";
import { Input } from "@plane/propel/input";
import { Menu } from "@plane/propel/menu";
import { Avatar, Breadcrumbs, EModalWidth, Header, ModalCore, Row } from "@plane/ui";
import { calculateTimeAgo, cn } from "@plane/utils";
import { Ellipsis, ListFilter, RefreshCw, X } from "lucide-react";
import { BreadcrumbLink } from "@/components/common/breadcrumb-link";
import { SummonField } from "@/components/summon/forms";
import { NotificationEmptyState } from "@/components/workspace-notifications/sidebar/empty-state";
import { NotificationsLoader } from "@/components/workspace-notifications/sidebar/loader";
import { TaskDetailContent } from "../tasks/task-detail";
import { TaskLifecycle, useTaskLifecycle } from "../tasks/lifecycle";
import { MarkAllRead } from "./mark-all-read";
import { mutationMessage } from "../commercial/forms";

type Selection = FunctionArgs<typeof api.notifications.index.list>;
type Notification = FunctionReturnType<typeof api.notifications.index.list>["page"][number];
const eventLabels = {
  created: "Task created",
  status_changed: "Status changed",
  updated: "Task updated",
  archived: "Task archived",
  unarchived: "Task unarchived",
  deleted: "Task deleted",
  restored: "Task restored",
  reaction_changed: "Reaction changed",
  comment_created: "Comment added",
  comment_updated: "Comment edited",
  comment_deleted: "Comment deleted",
  comment_restored: "Comment restored",
} satisfies Record<NonNullable<Notification["event"]>["kind"], string>;

export function Notifications({
  workspace,
}: {
  workspace: FunctionReturnType<typeof api.workspaces.index.list>[number];
}) {
  const { t } = useTranslation();
  const [params, setParams] = useSearchParams();
  const requestedView = params.get("inbox");
  const view: Selection["view"] = requestedView === "archived" || requestedView === "snoozed" ? requestedView : "inbox";
  const categories: NonNullable<Selection["categories"]> = FILTER_TYPE_OPTIONS.filter(({ value }) =>
    params.getAll("category").includes(value)
  ).map(({ value }) => value);
  const mentionsOnly = params.get("mentions") === "true";
  const unreadOnly = params.get("unread") === "true";
  const [markingRead, setMarkingRead] = useState(false);
  const [now, setNow] = useState(Date.now);
  const [browsingHistory, setBrowsingHistory] = useState(false);
  const rows = useRef<HTMLUListElement>(null);
  useEffect(() => {
    const refresh = () => {
      if (!browsingHistory && !rows.current?.contains(document.activeElement) && document.visibilityState === "visible")
        setNow(Date.now());
    };
    const interval = setInterval(refresh, 30_000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [browsingHistory]);
  const notifications = usePaginatedQuery(
    api.notifications.index.list,
    { workspaceId: workspace._id, view, unreadOnly, mentionsOnly, categories, now },
    { initialNumItems: 30 }
  );
  const profile = useQuery(api.identity.profile.get);
  const selectedTask = params.get("notificationTask");
  const selectedProject = params.get("notificationProject");
  const selected = selectedTask !== null && selectedProject !== null;
  const close = () =>
    setParams((current) => {
      const next = new URLSearchParams(current);
      for (const key of ["notification", "notificationTask", "notificationProject", "comment"]) next.delete(key);
      return next;
    });
  const filter = (key: string, value: string | null) => {
    setBrowsingHistory(false);
    setNow(Date.now());
    setParams((current) => {
      const next = new URLSearchParams(current);
      if (value) next.set(key, value);
      else next.delete(key);
      return next;
    });
  };
  return (
    <div className="relative flex h-full min-h-0 w-full overflow-hidden">
      <aside
        aria-label="Notifications"
        className={cn(
          "relative flex h-full shrink-0 flex-col border-subtle bg-surface-1 md:w-3/12 md:min-w-72 md:border-r",
          selected ? "hidden md:flex" : "w-full"
        )}
      >
        <Row className="flex h-header shrink-0 border-b border-subtle">
          <Header className="my-auto bg-surface-1">
            <Header.LeftItem>
              <Breadcrumbs>
                <Breadcrumbs.Item
                  component={
                    <BreadcrumbLink
                      label={t("notification.label")}
                      icon={<InboxIcon className="size-4 text-primary" />}
                      disableTooltip
                    />
                  }
                />
              </Breadcrumbs>
            </Header.LeftItem>
            <Header.RightItem>
              <IconButton
                icon={RefreshCw}
                variant="ghost"
                aria-label={t("notification.options.refresh")}
                disabled={markingRead}
                onClick={() => {
                  setBrowsingHistory(false);
                  setNow(Date.now());
                }}
              />
              <Menu
                ariaLabel={t("notification.options.filters")}
                customButton={<ListFilter className="size-4" />}
                disabled={markingRead}
              >
                {FILTER_TYPE_OPTIONS.map(({ value, i18n_label }) => (
                  <Menu.MenuItem
                    key={value}
                    onClick={() => {
                      setBrowsingHistory(false);
                      setNow(Date.now());
                      setParams((current) => {
                        const next = new URLSearchParams(current);
                        next.delete("category");
                        for (const option of FILTER_TYPE_OPTIONS)
                          if (option.value === value ? !categories.includes(value) : categories.includes(option.value))
                            next.append("category", option.value);
                        return next;
                      });
                    }}
                  >
                    <span aria-hidden>{categories.includes(value) ? "✓" : ""}</span>
                    {t(i18n_label)}
                  </Menu.MenuItem>
                ))}
              </Menu>
              <Menu ariaLabel="Inbox options" customButton={<Ellipsis className="size-4" />} disabled={markingRead}>
                <Menu.MenuItem onClick={() => filter("unread", unreadOnly ? null : "true")}>
                  {unreadOnly ? "Show all notifications" : t("notification.options.show_unread")}
                </Menu.MenuItem>
                <Menu.MenuItem onClick={() => filter("inbox", view === "archived" ? null : "archived")}>
                  {view === "archived" ? "Show inbox" : t("notification.options.show_archived")}
                </Menu.MenuItem>
                <Menu.MenuItem onClick={() => filter("inbox", view === "snoozed" ? null : "snoozed")}>
                  {view === "snoozed" ? "Show inbox" : t("notification.options.show_snoozed")}
                </Menu.MenuItem>
              </Menu>
            </Header.RightItem>
          </Header>
        </Row>
        <nav aria-label="Notification tabs" className="flex h-11 shrink-0 border-b border-subtle px-4">
          {NOTIFICATION_TABS.map((tab) => (
            <button
              key={tab.value}
              type="button"
              disabled={markingRead}
              aria-pressed={mentionsOnly === (tab.value === ENotificationTab.MENTIONS)}
              className={cn(
                "border-b-2 px-3 text-body-xs-medium",
                mentionsOnly === (tab.value === ENotificationTab.MENTIONS)
                  ? "border-accent-strong text-accent-primary"
                  : "border-transparent text-secondary"
              )}
              onClick={() => filter("mentions", tab.value === ENotificationTab.MENTIONS ? "true" : null)}
            >
              {t(tab.i18n_label)}
            </button>
          ))}
        </nav>
        <div className="space-y-2 border-b border-subtle px-4 py-2">
          {(view !== "inbox" || unreadOnly || categories.length > 0) && (
            <div className="flex flex-wrap gap-2 text-11 text-secondary">
              {view !== "inbox" && (
                <Button variant="secondary" size="sm" disabled={markingRead} onClick={() => filter("inbox", null)}>
                  {view} ×
                </Button>
              )}
              {unreadOnly && (
                <Button variant="secondary" size="sm" disabled={markingRead} onClick={() => filter("unread", null)}>
                  Unread ×
                </Button>
              )}
              {categories.map((category) => (
                <span key={category}>{category}</span>
              ))}
            </div>
          )}
          <MarkAllRead
            selection={{ workspaceId: workspace._id, view, mentionsOnly, categories }}
            onPending={setMarkingRead}
          />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {notifications.status === "LoadingFirstPage" ? (
            <NotificationsLoader />
          ) : (
            <ul ref={rows}>
              {notifications.results.map((notification) => (
                <NotificationRow
                  key={notification._id}
                  notification={notification}
                  compact={profile?.preferences.notificationViewMode === "compact"}
                  selected={params.get("notification") === notification._id}
                  onInteract={() => setBrowsingHistory(true)}
                  onOpen={() =>
                    setParams((current) => {
                      const next = new URLSearchParams(current);
                      next.set("notification", notification._id);
                      next.set("notificationTask", notification.taskId);
                      next.set("notificationProject", notification.projectId);
                      next.delete("comment");
                      if (notification.event?.commentId) next.set("comment", notification.event.commentId);
                      return next;
                    })
                  }
                />
              ))}
            </ul>
          )}
          {notifications.status === "Exhausted" && !notifications.results.length && (
            <div className="flex h-full items-center justify-center p-5">
              <NotificationEmptyState
                currentNotificationTab={mentionsOnly ? ENotificationTab.MENTIONS : ENotificationTab.ALL}
              />
            </div>
          )}
          {(notifications.status === "CanLoadMore" || notifications.status === "LoadingMore") && (
            <div className="p-4 text-center">
              <Button
                variant="ghost"
                loading={notifications.status === "LoadingMore"}
                onClick={() => {
                  setBrowsingHistory(true);
                  notifications.loadMore(30);
                }}
              >
                {t("load_more")}
              </Button>
            </div>
          )}
        </div>
      </aside>
      <div className={cn("h-full min-w-0 flex-1", !selected && "hidden md:block")}>
        {selected ? (
          <NotificationPreview
            workspace={workspace}
            taskId={selectedTask}
            projectId={selectedProject}
            onClose={close}
          />
        ) : (
          <div className="flex size-full items-center justify-center">
            <EmptyStateCompact assetKey="unknown" assetClassName="size-20" />
          </div>
        )}
      </div>
    </div>
  );
}

function NotificationPreview({
  workspace,
  taskId,
  projectId,
  onClose,
}: {
  workspace: FunctionReturnType<typeof api.workspaces.index.list>[number];
  taskId: string;
  projectId: string;
  onClose: () => void;
}) {
  const [params] = useSearchParams();
  const comment = params.get("comment");
  const commentQuery = comment ? new URLSearchParams({ comment }).toString() : "";
  const address = useQuery(api.navigation.address.resolveTaskId, { workspaceId: workspace._id, taskId, projectId });
  const lifecycle = useTaskLifecycle((operation) => {
    if (operation === "delete" || operation === "archive") onClose();
  });
  if (address?.kind === "task")
    return (
      <TaskDetailContent
        key={address.task._id}
        task={address.task}
        project={address.project}
        lifecyclePending={lifecycle.pending}
        propertyPlacement="inline"
        header={(hasUnsavedText) => (
          <header className="flex h-header shrink-0 items-center justify-between gap-2 border-b border-subtle px-4">
            <div className="flex items-center gap-2">
              <IconButton icon={X} variant="ghost" aria-label="Close notification" onClick={onClose} />
              <Link
                to={`/${workspace.slug}/browse/${address.workItem}/${commentQuery ? `?${commentQuery}` : ""}`}
                className="text-13 text-secondary hover:text-accent-primary"
              >
                {address.workItem}
              </Link>
            </div>
            <TaskLifecycle task={address.task} disabled={hasUnsavedText} lifecycle={lifecycle} />
          </header>
        )}
      />
    );
  return (
    <section className="space-y-4 p-6">
      <Button variant="secondary" onClick={onClose}>
        Back to inbox
      </Button>
      {address === undefined ? (
        <p role="status">Opening work item…</p>
      ) : address?.kind === "intake" ? (
        <Link
          className="text-accent-primary"
          to={`/${workspace.slug}/projects/${address.project._id}/intake/?${new URLSearchParams({
            currentTab: address.intake.status === "pending" || address.intake.status === "snoozed" ? "open" : "closed",
            inboxIssueId: address.intake.taskId,
            ...(comment ? { comment } : {}),
          })}`}
        >
          Open intake work item
        </Link>
      ) : (
        <p role="alert">This work item is unavailable. It may have been removed or your access may have changed.</p>
      )}
    </section>
  );
}

function NotificationRow({
  notification,
  compact,
  selected,
  onOpen,
  onInteract,
}: {
  notification: Notification;
  compact: boolean;
  selected: boolean;
  onOpen: () => void;
  onInteract: () => void;
}) {
  const { t } = useTranslation();
  const update = useMutation(api.notifications.index.update);
  const [snoozing, setSnoozing] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const change = async (value: FunctionArgs<typeof api.notifications.index.update>["change"]) => {
    setPending(true);
    setError("");
    try {
      await update({ notificationId: notification._id, change: value });
      setSnoozing(false);
    } catch (failure) {
      setError(mutationMessage(failure));
    } finally {
      setPending(false);
    }
  };
  const activity = notification.event;
  return (
    <li
      className={cn(
        "relative border-b border-subtle px-4",
        compact ? "py-2" : "py-4",
        selected && "bg-layer-1/30",
        notification.readAt === null && "bg-accent-primary/5"
      )}
    >
      <div className="flex items-start gap-2">
        {!compact && <Avatar name={notification.actorName ?? undefined} size={42} shape="circle" />}
        <button
          type="button"
          disabled={pending}
          className="min-w-0 flex-1 text-left"
          aria-current={selected ? "true" : undefined}
          onClick={async () => {
            setPending(true);
            setError("");
            onInteract();
            try {
              if (notification.readAt === null)
                await update({ notificationId: notification._id, change: { kind: "read", value: true } });
              onOpen();
            } catch (failure) {
              setError(mutationMessage(failure));
            } finally {
              setPending(false);
            }
          }}
        >
          <span className="block text-body-xs-medium text-primary">
            {notification.actorName ?? "Former member"} ·{" "}
            {activity
              ? activity.kind === "status_changed"
                ? `Status changed to ${activity.status.replaceAll("_", " ")}`
                : eventLabels[activity.kind]
              : "Task activity unavailable"}
          </span>
          <span className="mt-1 block truncate text-caption-sm-regular text-secondary">
            {notification.taskReference} {notification.taskTitle}
          </span>
          <span className="mt-1 block text-11 text-tertiary">
            {calculateTimeAgo(new Date(notification._creationTime).toISOString())}
            {notification.readAt === null && " · Unread"}
            {notification.isMention && " · Mentioned you"}
          </span>
        </button>
        <Menu
          ariaLabel={`Notification actions for ${notification.taskTitle}`}
          customButton={<Ellipsis className="size-4" />}
          onOpen={onInteract}
          disabled={pending}
        >
          <Menu.MenuItem onClick={() => void change({ kind: "read", value: notification.readAt === null })}>
            {notification.readAt === null ? "Mark read" : "Mark unread"}
          </Menu.MenuItem>
          <Menu.MenuItem onClick={() => void change({ kind: "archive", value: notification.archivedAt === null })}>
            {notification.archivedAt === null ? "Archive" : "Unarchive"}
          </Menu.MenuItem>
          {notification.snoozedUntil !== null && (
            <Menu.MenuItem onClick={() => void change({ kind: "snooze", until: null })}>Clear snooze</Menu.MenuItem>
          )}
          {NOTIFICATION_SNOOZE_OPTIONS.map((option) => (
            <Menu.MenuItem
              key={option.key}
              onClick={() => {
                if (option.value) void change({ kind: "snooze", until: option.value().getTime() });
                else setSnoozing(true);
              }}
            >
              {t(option.i18n_label)}
            </Menu.MenuItem>
          ))}
        </Menu>
      </div>
      {notification.snoozedUntil !== null && (
        <p className="mt-2 text-11 text-tertiary">
          Snoozed until {new Date(notification.snoozedUntil).toLocaleString()}
        </p>
      )}
      {error && (
        <p role="alert" className="mt-2 text-12 text-danger-primary">
          {error}
        </p>
      )}
      <ModalCore
        isOpen={snoozing}
        handleClose={() => {
          if (!pending) setSnoozing(false);
        }}
        width={EModalWidth.LG}
      >
        <form
          className="space-y-4 p-6"
          onSubmit={(event) => {
            event.preventDefault();
            const until = new FormData(event.currentTarget).get("until");
            if (typeof until === "string") void change({ kind: "snooze", until: Date.parse(until) });
          }}
        >
          <Dialog.Title className="text-20 font-semibold">Snooze notification</Dialog.Title>
          <SummonField label="Snooze until">
            <Input type="datetime-local" required name="until" disabled={pending} />
          </SummonField>
          {error && (
            <p role="alert" className="text-12 text-danger-primary">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" disabled={pending} onClick={() => setSnoozing(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={pending}>
              Save snooze
            </Button>
          </div>
        </form>
      </ModalCore>
    </li>
  );
}
