import { useId, useState } from "react";
import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
import type { FunctionReturnType, FunctionArgs } from "convex/server";
import type { Id } from "@summon/convex/data-model";
import { api } from "@summon/convex/api";
import { Button } from "@plane/propel/button";
import { Input } from "@plane/propel/input";
import { SummonField } from "@/components/summon/forms";

type Meeting = FunctionReturnType<typeof api.meetings.index.get>;
type Projects = FunctionReturnType<typeof api.projects.index.list>;
type Props = {
  workspaceId: Id<"workspaces">;
  initial?: Meeting;
  projects: Projects;
  onClose: () => void;
  onSaved: (id: Id<"meetings">) => void;
};
export function MeetingForm(props: Props) {
  const participants = useQuery(
    api.meetings.index.participants,
    props.initial ? { workspaceId: props.workspaceId, meetingId: props.initial._id } : "skip"
  );
  if (props.initial && !participants) return <p role="status">Loading participants…</p>;
  return <Form {...props} participants={participants ?? []} />;
}
function localTime(timestamp: number) {
  const date = new Date(timestamp);
  return new Date(timestamp - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}
function Form({
  workspaceId,
  initial,
  projects,
  onClose,
  onSaved,
  participants,
}: Props & { participants: FunctionReturnType<typeof api.meetings.index.participants> }) {
  const save = useMutation(api.meetings.index.save);
  const {
    results: people,
    status: peopleStatus,
    loadMore,
  } = usePaginatedQuery(api.commercial.directory.members, { workspaceId }, { initialNumItems: 50 });
  const [data, setData] = useState<FunctionArgs<typeof api.meetings.index.save>["data"]>(() =>
    initial
      ? {
          title: initial.title,
          agenda: initial.agenda,
          notes: initial.notes,
          location: initial.location,
          meetingUrl: initial.meetingUrl,
          status: initial.status,
          startsAt: initial.startsAt,
          endsAt: initial.endsAt,
          projectId: initial.projectId,
          summaryDocumentId: initial.summaryDocumentId,
        }
      : {
          title: "",
          agenda: "",
          notes: "",
          location: "",
          meetingUrl: "",
          status: "scheduled",
          startsAt: Date.now(),
          endsAt: null,
          projectId: null,
          summaryDocumentId: null,
        }
  );
  const [selected, setSelected] = useState(participants.map((person) => person.userId));
  const [start, setStart] = useState(localTime(data.startsAt));
  const [end, setEnd] = useState(data.endsAt === null ? "" : localTime(data.endsAt));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const projectId = useId();
  const statusId = useId();
  return (
    <form
      className="max-w-3xl space-y-5"
      onSubmit={(event) => {
        event.preventDefault();
        setPending(true);
        setError("");
        void save({
          workspaceId,
          meetingId: initial?._id,
          data: { ...data, startsAt: new Date(start).getTime(), endsAt: end ? new Date(end).getTime() : null },
          participantIds: selected,
        })
          .then(onSaved)
          .catch(() => setError("Could not save meeting. Check its times, links, and your current access."))
          .finally(() => setPending(false));
      }}
    >
      <h1 className="text-xl font-semibold">{initial ? "Edit meeting" : "Schedule meeting"}</h1>
      <SummonField label="Meeting title">
        <Input
          value={data.title}
          required
          maxLength={255}
          onChange={(event) => setData({ ...data, title: event.target.value })}
        />
      </SummonField>
      <div className="grid gap-4 sm:grid-cols-2">
        <SummonField label="Starts at">
          <Input type="datetime-local" value={start} required onChange={(event) => setStart(event.target.value)} />
        </SummonField>
        <SummonField label="Ends at">
          <Input type="datetime-local" value={end} onChange={(event) => setEnd(event.target.value)} />
        </SummonField>
      </div>
      <SummonField label="Meeting project" htmlFor={projectId}>
        <select
          id={projectId}
          className="rounded border border-subtle-1 bg-layer-1 p-2 text-primary"
          value={data.projectId ?? ""}
          onChange={(event) =>
            setData({ ...data, projectId: projects.find((project) => project._id === event.target.value)?._id ?? null })
          }
        >
          <option value="">Workspace meeting</option>
          {projects
            .filter((project) => project.membershipRole !== "guest")
            .map((project) => (
              <option key={project._id} value={project._id}>
                {project.name}
              </option>
            ))}
        </select>
      </SummonField>
      <SummonField label="Meeting status" htmlFor={statusId}>
        <select
          id={statusId}
          className="rounded border border-subtle-1 bg-layer-1 p-2 text-primary"
          value={data.status}
          onChange={(event) => {
            const status = event.target.value;
            if (status === "scheduled" || status === "completed" || status === "cancelled")
              setData({ ...data, status });
          }}
        >
          <option value="scheduled">Scheduled</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </SummonField>
      <SummonField label="Location">
        <Input
          value={data.location}
          maxLength={255}
          onChange={(event) => setData({ ...data, location: event.target.value })}
        />
      </SummonField>
      <SummonField label="Meeting URL">
        <Input
          type="url"
          value={data.meetingUrl}
          maxLength={200}
          onChange={(event) => setData({ ...data, meetingUrl: event.target.value })}
        />
      </SummonField>
      <SummonField label="Agenda">
        <textarea
          className="min-h-24 rounded border border-subtle-1 bg-layer-1 p-3 text-primary"
          value={data.agenda}
          maxLength={100000}
          onChange={(event) => setData({ ...data, agenda: event.target.value })}
        />
      </SummonField>
      <SummonField label="Notes">
        <textarea
          className="min-h-24 rounded border border-subtle-1 bg-layer-1 p-3 text-primary"
          value={data.notes}
          maxLength={100000}
          onChange={(event) => setData({ ...data, notes: event.target.value })}
        />
      </SummonField>
      <fieldset>
        <legend className="mb-2 font-semibold">Participants</legend>
        {selected.length > 0 && (
          <ul aria-label="Selected participants" className="mb-4 flex flex-wrap gap-2">
            {selected.map((userId) => {
              const person =
                people.find((candidate) => candidate.id === userId) ??
                participants.find((candidate) => candidate.userId === userId);
              const label = person?.name ?? person?.email ?? userId;
              return (
                <li key={userId} className="flex items-center gap-2 rounded border border-subtle-1 px-2 py-1">
                  <span>{label}</span>
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={pending}
                    aria-label={`Remove participant ${label}`}
                    onClick={() => setSelected(selected.filter((id) => id !== userId))}
                  >
                    Remove
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
        <div className="space-y-2">
          {people.map((person) => (
            <label key={person.id} className="flex items-center gap-2">
              <input
                type="checkbox"
                disabled={pending}
                checked={selected.includes(person.id)}
                onChange={(event) =>
                  setSelected(
                    event.target.checked ? [...selected, person.id] : selected.filter((id) => id !== person.id)
                  )
                }
              />
              {person.name ?? person.email ?? person.id}
            </label>
          ))}
        </div>
        {peopleStatus === "CanLoadMore" && (
          <Button type="button" variant="secondary" onClick={() => loadMore(50)}>
            Load more people
          </Button>
        )}
      </fieldset>
      {error && (
        <p role="alert" className="text-danger-primary">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save meeting"}
        </Button>
        <Button type="button" variant="secondary" disabled={pending} onClick={onClose}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
