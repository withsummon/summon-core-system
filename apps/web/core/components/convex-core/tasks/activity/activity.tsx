import { useState } from "react";
import { usePaginatedQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "@summon/convex/api";
import type { Id } from "@summon/convex/data-model";
import { Button } from "@plane/propel/button";
import { taskStatusOptions } from "../options";
type Event = FunctionReturnType<typeof api.tasks.activity.list>["page"][number];
const labels = {
  created: "created this task",
  status_changed: "changed the state",
  updated: "updated this task",
  comment_created: "added a comment",
  comment_updated: "edited a comment",
  comment_deleted: "removed a comment",
  comment_restored: "restored a comment",
} satisfies Record<Event["kind"], string>;
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
              <span className="font-medium">{event.actorName || "Member"}</span> {labels[event.kind]}
              {event.kind === "status_changed" && ` to ${taskStatusOptions[event.status].label}`}
            </p>
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
