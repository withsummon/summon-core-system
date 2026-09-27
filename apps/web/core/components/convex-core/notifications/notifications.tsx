import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router";
import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
import type { FunctionArgs, FunctionReturnType } from "convex/server";
import { api } from "@summon/convex/api";
import { Button } from "@plane/propel/button";
import { Input } from "@plane/propel/input";
import { SummonField } from "@/components/summon/forms";
import { MarkAllRead } from "./mark-all-read";
import { notificationTarget } from "./comment-target";
import { mutationMessage } from "../commercial/forms";
type View = FunctionArgs<typeof api.notifications.index.list>["view"];
type Notification = FunctionReturnType<typeof api.notifications.index.list>["page"][number];
const eventLabels = {
  created: "Task created",
  status_changed: "Status changed",
  updated: "Task updated",
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
  const [params, setParams] = useSearchParams();
  const requestedView = params.get("inbox");
  const view: View = requestedView === "archived" || requestedView === "snoozed" ? requestedView : "inbox";
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [markingRead, setMarkingRead] = useState(false);
  const categories = (["assigned", "subscribed", "created"] as const).filter((category) =>
    params.getAll("category").includes(category)
  );
  const mentionsOnly = params.get("mentions") === "true";
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
  const projects = useQuery(api.projects.index.list, { workspaceId: workspace._id });
  const profile = useQuery(api.identity.profile.get);
  return (
    <section className="space-y-5">
      <header>
        <p className="text-12 text-secondary">{workspace.name}</p>
        <h1 className="text-28 font-semibold">Notifications</h1>
      </header>
      <fieldset
        disabled={markingRead}
        className="flex flex-wrap items-center justify-between gap-3 border-b border-subtle-1 pb-3"
      >
        <nav aria-label="Notification views" className="flex flex-wrap gap-2">
          {(["inbox", "snoozed", "archived"] as const).map((value) => (
            <Button
              key={value}
              variant={view === value ? "primary" : "secondary"}
              onClick={() => {
                setBrowsingHistory(false);
                setNow(Date.now());
                setParams((current) => {
                  const next = new URLSearchParams(current);
                  next.set("inbox", value);
                  return next;
                });
              }}
            >
              {value[0].toUpperCase() + value.slice(1)}
            </Button>
          ))}
        </nav>
        <label className="flex items-center gap-2 text-14">
          <input
            type="checkbox"
            checked={mentionsOnly}
            onChange={(event) => {
              const checked = event.target.checked;
              setBrowsingHistory(false);
              setNow(Date.now());
              setParams((current) => {
                const next = new URLSearchParams(current);
                if (checked) next.set("mentions", "true");
                else next.delete("mentions");
                return next;
              });
            }}
          />
          Mentions only
        </label>
        <label className="flex items-center gap-2 text-14">
          <input
            type="checkbox"
            checked={unreadOnly}
            onChange={(e) => {
              setBrowsingHistory(false);
              setNow(Date.now());
              setUnreadOnly(e.target.checked);
            }}
          />
          Unread only
        </label>
      </fieldset>
      <fieldset disabled={markingRead} className="flex flex-wrap gap-4">
        <legend className="mb-2 text-14 font-medium">Task relationship · any selected</legend>
        {(["assigned", "subscribed", "created"] as const).map((category) => (
          <label key={category} className="flex items-center gap-2 text-14">
            <input
              type="checkbox"
              checked={categories.includes(category)}
              onChange={(event) => {
                const checked = event.target.checked;
                setBrowsingHistory(false);
                setNow(Date.now());
                setParams((current) => {
                  const next = new URLSearchParams(current);
                  next.delete("category");
                  for (const value of ["assigned", "subscribed", "created"] as const)
                    if (value === category ? checked : categories.includes(value)) next.append("category", value);
                  return next;
                });
              }}
            />
            {category === "assigned" ? "Assigned to me" : category === "created" ? "Created by me" : "Subscribed only"}
          </label>
        ))}
        <p className="w-full text-12 text-secondary">
          No selection shows all relationships. Subscribed only excludes tasks assigned to or created by you.
        </p>
      </fieldset>
      <MarkAllRead
        selection={{ workspaceId: workspace._id, view, mentionsOnly, categories }}
        onPending={setMarkingRead}
      />
      <div className="flex flex-wrap items-center gap-3">
        <Button
          variant="secondary"
          onClick={() => {
            setBrowsingHistory(false);
            setNow(Date.now());
          }}
        >
          Refresh notifications
        </Button>
        {browsingHistory && (
          <p className="text-12 text-secondary">
            Automatic snooze refresh is paused while you browse older notifications.
          </p>
        )}
      </div>
      <ul ref={rows} className="divide-y divide-subtle-1">
        {notifications.results.map((notification) => (
          <NotificationRow
            key={notification._id}
            notification={notification}
            compact={profile?.preferences.notificationViewMode === "compact"}
            onOpen={() => {
              const project = projects?.find((p) => p._id === notification.projectId);
              if (project)
                setParams(
                  notificationTarget(
                    workspace.slug,
                    project.identifier,
                    notification.taskId,
                    notification.event?.commentId,
                    notification.destination
                  )
                );
            }}
            canOpen={Boolean(projects?.some((p) => p._id === notification.projectId))}
          />
        ))}
      </ul>
      {notifications.status === "LoadingFirstPage" && <p role="status">Loading notifications…</p>}
      {notifications.status === "Exhausted" && !notifications.results.length && (
        <div className="py-12 text-center">
          <h2 className="text-20 font-medium">{view === "inbox" ? "You're caught up" : `No ${view} notifications`}</h2>
          <p className="mt-2 text-14 text-secondary">Updates from tasks you subscribe to will appear here.</p>
        </div>
      )}
      {notifications.status === "CanLoadMore" && (
        <Button
          variant="secondary"
          onClick={() => {
            setBrowsingHistory(true);
            notifications.loadMore(30);
          }}
        >
          Load more notifications
        </Button>
      )}
    </section>
  );
}
function NotificationRow({
  notification,
  compact,
  onOpen,
  canOpen,
}: {
  notification: Notification;
  compact: boolean;
  onOpen: () => void;
  canOpen: boolean;
}) {
  const update = useMutation(api.notifications.index.update);
  const [snoozing, setSnoozing] = useState(false);
  const [until, setUntil] = useState("");
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
  const event = notification.event;
  return (
    <li
      className={`${compact ? "space-y-1 py-2" : "space-y-3 py-4"} ${notification.readAt === null ? "font-medium" : ""}`}
    >
      <div className={`flex flex-wrap items-start justify-between ${compact ? "gap-1" : "gap-3"}`}>
        <div className="min-w-0">
          <button
            disabled={!canOpen || pending}
            className="max-w-full text-left text-16 break-words hover:text-accent-primary"
            onClick={async () => {
              setPending(true);
              setError("");
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
            {notification.taskTitle}
          </button>
          <p className="font-normal mt-1 text-12 text-secondary">
            {event?.kind === "status_changed"
              ? `Status changed to ${event.status?.replaceAll("_", " ")}`
              : event
                ? eventLabels[event.kind]
                : "Task activity unavailable"}{" "}
            · {new Date(notification._creationTime).toLocaleString()}
            {notification.readAt === null ? " · Unread" : ""}
            {notification.isMention ? " · Mentioned you" : ""}
          </p>
          {notification.snoozedUntil !== null && (
            <p className="font-normal mt-1 text-12 text-secondary">
              {notification.snoozedUntil <= Date.now() ? "Snooze ended" : "Snoozed until"}{" "}
              {new Date(notification.snoozedUntil).toLocaleString()}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            disabled={pending}
            onClick={() => void change({ kind: "read", value: notification.readAt === null })}
          >
            {notification.readAt === null ? "Mark read" : "Mark unread"}
          </Button>
          <Button
            variant="secondary"
            disabled={pending}
            onClick={() => void change({ kind: "archive", value: notification.archivedAt === null })}
          >
            {notification.archivedAt === null ? "Archive" : "Unarchive"}
          </Button>
          {notification.snoozedUntil !== null ? (
            <Button variant="secondary" disabled={pending} onClick={() => void change({ kind: "snooze", until: null })}>
              Clear snooze
            </Button>
          ) : (
            <Button variant="secondary" disabled={pending} onClick={() => setSnoozing(!snoozing)}>
              Snooze
            </Button>
          )}
        </div>
      </div>
      {snoozing && (
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void change({ kind: "snooze", until: new Date(until).getTime() });
          }}
        >
          <SummonField label="Snooze until">
            <Input type="datetime-local" required value={until} onChange={(e) => setUntil(e.target.value)} />
          </SummonField>
          <Button type="submit" loading={pending}>
            Save snooze
          </Button>
          <Button variant="secondary" disabled={pending} onClick={() => setSnoozing(false)}>
            Cancel
          </Button>
        </form>
      )}
      {error && (
        <p role="alert" className="font-normal text-14 text-danger-primary">
          {error}
        </p>
      )}
    </li>
  );
}
