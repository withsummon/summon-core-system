import { useState } from "react";
import { usePaginatedQuery, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import type { Id } from "@summon/convex/data-model";
import { api } from "@summon/convex/api";
import { Button } from "@plane/propel/button";
import { MeetingForm } from "./meeting-form";
import { MeetingTasks } from "./meeting-tasks";

type Workspace = FunctionReturnType<typeof api.workspaces.index.list>[number];
export function Meetings({ workspace }: { workspace: Workspace }) {
  const [selected, setSelected] = useState<Id<"meetings"> | null>(null);
  const [editing, setEditing] = useState(false);
  const { results, status, loadMore } = usePaginatedQuery(
    api.meetings.index.list,
    { workspaceId: workspace._id },
    { initialNumItems: 50 }
  );
  const meeting = useQuery(
    api.meetings.index.get,
    selected ? { workspaceId: workspace._id, meetingId: selected } : "skip"
  );
  const projects = useQuery(api.projects.index.list, { workspaceId: workspace._id });
  const project = projects?.find((item) => item._id === meeting?.projectId);
  const canWrite =
    workspace.membershipRole !== "guest" &&
    (!meeting?.projectId || Boolean(project && project.membershipRole !== "guest"));
  if (editing && canWrite)
    return (
      <MeetingForm
        workspaceId={workspace._id}
        initial={meeting}
        projects={projects ?? []}
        onClose={() => setEditing(false)}
        onSaved={(id) => {
          setSelected(id);
          setEditing(false);
        }}
      />
    );
  if (selected)
    return meeting ? (
      <section className="max-w-4xl space-y-6">
        <Button variant="secondary" onClick={() => setSelected(null)}>
          Back to meetings
        </Button>
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm text-secondary">{project?.name ?? "Workspace meeting"}</p>
            <h1 className="text-xl font-semibold">{meeting.title}</h1>
          </div>
          {canWrite && <Button onClick={() => setEditing(true)}>Edit meeting</Button>}
        </header>
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {Object.entries({
            Status: meeting.status,
            Start: new Date(meeting.startsAt).toLocaleString(),
            End: meeting.endsAt ? new Date(meeting.endsAt).toLocaleString() : "Not set",
            Location: meeting.location || "Not set",
          }).map(([label, value]) => (
            <div key={label}>
              <dt className="text-sm text-secondary">{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
        {meeting.meetingUrl && (
          <a className="text-accent-primary" href={meeting.meetingUrl} target="_blank" rel="noreferrer">
            Open meeting link
          </a>
        )}
        <section>
          <h2 className="font-semibold">Agenda</h2>
          <p className="mt-2 whitespace-pre-wrap">{meeting.agenda || "No agenda yet."}</p>
        </section>
        <section>
          <h2 className="font-semibold">Notes</h2>
          <p className="mt-2 whitespace-pre-wrap">{meeting.notes || "No notes yet."}</p>
        </section>
        <Participants workspaceId={workspace._id} meetingId={meeting._id} />
        <MeetingTasks workspaceId={workspace._id} meeting={meeting} projects={projects ?? []} canWrite={canWrite} />
      </section>
    ) : (
      <p role="status">Loading meeting…</p>
    );
  return (
    <section className="space-y-5">
      <header className="flex items-center justify-between gap-4">
        <h1 className="text-xl font-semibold">Meetings</h1>
        {workspace.membershipRole !== "guest" && <Button onClick={() => setEditing(true)}>Schedule meeting</Button>}
      </header>
      <div className="grid gap-3">
        {results.map((row) => (
          <button
            key={row._id}
            onClick={() => setSelected(row._id)}
            className="rounded-xl border border-subtle-1 p-4 text-left hover:bg-layer-2"
          >
            <h2 className="font-semibold">{row.title}</h2>
            <p className="text-sm mt-1 text-secondary">
              {new Date(row.startsAt).toLocaleString()} · {row.status}
            </p>
          </button>
        ))}
      </div>
      {status === "LoadingFirstPage" && <p role="status">Loading meetings…</p>}
      {status === "Exhausted" && results.length === 0 && <p className="text-secondary">No meetings yet.</p>}
      {status === "CanLoadMore" && (
        <Button variant="secondary" onClick={() => loadMore(50)}>
          Load more meetings
        </Button>
      )}
    </section>
  );
}
function Participants({ workspaceId, meetingId }: { workspaceId: Id<"workspaces">; meetingId: Id<"meetings"> }) {
  const participants = useQuery(api.meetings.index.participants, { workspaceId, meetingId });
  return (
    <section>
      <h2 className="font-semibold">Participants</h2>
      <ul className="mt-2 space-y-1">
        {participants?.map((person) => (
          <li key={person.id}>
            {person.name ?? person.email ?? person.userId}{" "}
            <span className="text-sm text-secondary">{person.response}</span>
          </li>
        ))}
      </ul>
      {participants?.length === 0 && <p className="mt-2 text-secondary">No participants selected.</p>}
    </section>
  );
}
