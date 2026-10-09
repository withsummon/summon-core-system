import { ActivityChanges } from "./changes";
import { useState } from "react";
import Link from "next/link";
import { usePaginatedQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "@summon/convex/api";
import type { Id } from "@summon/convex/data-model";
import { Button } from "@plane/propel/button";
import { generateWorkItemLink } from "@plane/utils";
import { taskStatusOptions } from "../options";
type Event = FunctionReturnType<typeof api.tasks.activity.list>["page"][number];
const actions = {
  created: "created",
  status_changed: "changed the state of",
  updated: "updated",
  archived: "archived",
  unarchived: "unarchived",
  deleted: "deleted",
  restored: "restored",
  reaction_changed: "changed a reaction on",
  vote_changed: "changed a vote on",
  comment_created: "added a comment to",
  comment_updated: "edited a comment on",
  comment_deleted: "removed a comment from",
  comment_restored: "restored a comment on",
} satisfies Record<Event["kind"], string>;
type ProfileEvent = FunctionReturnType<typeof api.tasks.activity.profile>["page"][number];

// The same native event drives recent activity and the full member activity feed.
export function ProfileActivityMessage({ event }: { event: ProfileEvent }) {
  const title = `${event.projectIdentifier}-${event.sequence} ${event.taskTitle}`;
  return (
    <>
      {actions[event.kind]}{" "}
      {event.deletedAt !== null || event.taskStatus === "triage" ? (
        <span className="font-medium text-primary">{title}</span>
      ) : (
        <Link
          href={generateWorkItemLink({
            workspaceSlug: event.workspaceSlug,
            projectId: event.projectId,
            issueId: event.taskId,
            projectIdentifier: event.projectIdentifier,
            sequenceId: event.sequence,
            isArchived: event.archivedAt !== null,
          })}
          className="font-medium text-primary hover:underline"
          target="_blank"
          rel="noopener noreferrer"
        >
          {title}
        </Link>
      )}
    </>
  );
}
export function TaskActivity({ taskId }: { taskId: Id<"tasks"> }) {
  const [open, setOpen] = useState(false);
  return (
    <section aria-label="Task activity" className="space-y-3">
      <Button variant="secondary" aria-expanded={open} onClick={() => setOpen(!open)}>
        {open ? "Hide activity" : "Show activity"}
      </Button>
      {open && <ActivityRows taskId={taskId} />}
    </section>
  );
}
function ActivityRows({ taskId }: { taskId: Id<"tasks"> }) {
  const rows = usePaginatedQuery(api.tasks.activity.list, { taskId }, { initialNumItems: 20 });
  return (
    <>
      <h3 className="text-16 font-semibold">Activity</h3>
      <ol className="divide-y divide-subtle-1">
        {rows.results.map((event) => (
          <li key={event.id} className="space-y-1 py-3 text-14">
            <p>
              <span className="font-medium">{event.automation ? "Automation" : event.actorName || "Member"}</span>{" "}
              {actions[event.kind]} this task
              {event.kind === "status_changed" &&
                !event.changes?.length &&
                ` to ${taskStatusOptions[event.status].label}`}
            </p>
            {event.changes && event.changes.length > 0 && <ActivityChanges changes={event.changes} />}
            <time className="text-12 text-secondary" dateTime={new Date(event.at).toISOString()}>
              {new Date(event.at).toLocaleString()}
            </time>
          </li>
        ))}
      </ol>
      {rows.status === "Exhausted" && !rows.results.length && (
        <p className="text-14 text-secondary">No recorded activity.</p>
      )}
      {(rows.status === "LoadingFirstPage" || rows.status === "LoadingMore") && <p role="status">Loading activity…</p>}
      {rows.status === "CanLoadMore" && (
        <Button variant="secondary" onClick={() => rows.loadMore(20)}>
          Load earlier activity
        </Button>
      )}
    </>
  );
}
