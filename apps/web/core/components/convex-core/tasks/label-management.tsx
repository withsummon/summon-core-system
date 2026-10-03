import { useState } from "react";
import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
import { api } from "@summon/convex/api";
import type { Doc, Id } from "@summon/convex/data-model";
import { Button } from "@plane/propel/button";
import { Input } from "@plane/propel/input";
import { SummonField } from "@/components/summon/forms";
import { field, mutationMessage, selectClass } from "../commercial/forms";
export function LabelManagement({ projectId }: { projectId: Id<"projects"> }) {
  const labels = useQuery(api.tasks.labels.list, { projectId });
  const [editing, setEditing] = useState<Doc<"taskLabels"> | null | undefined>();
  const [removing, setRemoving] = useState<Doc<"taskLabels"> | null>(null);
  return (
    <section className="space-y-3">
      <h3 className="text-14 font-medium">Labels & groups</h3>
      {labels && <LabelBranch labels={labels} parentId={null} onEdit={setEditing} onRemove={setRemoving} />}
      <Button variant="secondary" onClick={() => setEditing(null)}>
        New label
      </Button>
      {editing !== undefined && (
        <LabelEditor
          key={editing?._id ?? "new"}
          projectId={projectId}
          label={editing}
          labels={labels ?? []}
          onDone={() => setEditing(undefined)}
        />
      )}{" "}
      {removing && <RemoveLabel label={removing} onDone={() => setRemoving(null)} />}
      <RemovalJobs projectId={projectId} />
    </section>
  );
}
function LabelBranch({
  labels,
  parentId,
  onEdit,
  onRemove,
}: {
  labels: Doc<"taskLabels">[];
  parentId: Id<"taskLabels"> | null;
  onEdit: (label: Doc<"taskLabels">) => void;
  onRemove: (label: Doc<"taskLabels">) => void;
}) {
  return (
    <ul className="space-y-2">
      {labels
        .filter((label) => label.parentId === parentId)
        .map((label) => (
          <li key={label._id} className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2 text-14">
              <span>
                <span style={{ color: label.color }} aria-hidden>
                  ●{" "}
                </span>
                {label.name}
                {label.retiring ? " · Removing" : ""}
              </span>
              <div className="flex gap-2">
                <Button variant="secondary" disabled={label.retiring} onClick={() => onEdit(label)}>
                  Edit {label.name}
                </Button>
                <Button variant="secondary" disabled={label.retiring} onClick={() => onRemove(label)}>
                  Delete {label.name}
                </Button>
              </div>
            </div>
            {labels.some((child) => child.parentId === label._id) && (
              <div className="border-l border-subtle-1 pl-3">
                <LabelBranch labels={labels} parentId={label._id} onEdit={onEdit} onRemove={onRemove} />
              </div>
            )}
          </li>
        ))}
    </ul>
  );
}
function LabelEditor({
  projectId,
  label,
  labels,
  onDone,
}: {
  projectId: Id<"projects">;
  label: Doc<"taskLabels"> | null;
  labels: Doc<"taskLabels">[];
  onDone: () => void;
}) {
  const [snapshot] = useState(label),
    [parentId, setParentId] = useState(label?.parentId ?? null),
    [pending, setPending] = useState(false),
    [error, setError] = useState("");
  const save = useMutation(api.tasks.labels.save);
  return (
    <form
      className="space-y-3 rounded-md border border-subtle-1 p-3"
      onSubmit={async (event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        setPending(true);
        setError("");
        try {
          await save({
            projectId,
            labelId: snapshot?._id,
            expectedRevision: snapshot?.revision,
            parentId,
            data: {
              name: field(form, "name"),
              description: field(form, "description"),
              color: field(form, "color"),
              sortOrder: Number(field(form, "sortOrder")),
            },
          });
          onDone();
        } catch (failure) {
          setError(mutationMessage(failure));
        } finally {
          setPending(false);
        }
      }}
    >
      <fieldset disabled={pending} className="space-y-3">
        <SummonField label="Label name" htmlFor="project-label-name">
          <Input id="project-label-name" name="name" required maxLength={255} defaultValue={snapshot?.name} />
        </SummonField>
        <SummonField label="Description" htmlFor="project-label-description">
          <Input
            id="project-label-description"
            name="description"
            maxLength={10000}
            defaultValue={snapshot?.description}
          />
        </SummonField>
        <div className="grid grid-cols-2 gap-3">
          <SummonField label="Color" htmlFor="project-label-color">
            <Input id="project-label-color" type="color" name="color" defaultValue={snapshot?.color || "#6366f1"} />
          </SummonField>
          <SummonField label="Order" htmlFor="project-label-order">
            <Input
              id="project-label-order"
              type="number"
              step="any"
              name="sortOrder"
              required
              defaultValue={snapshot?.sortOrder ?? 0}
            />
          </SummonField>
        </div>
        <SummonField label="Parent group" htmlFor="project-label-parent">
          <select
            id="project-label-parent"
            className={selectClass}
            value={parentId ?? ""}
            onChange={(event) => {
              const selected = labels.find((row) => row._id === event.target.value);
              setParentId(selected ? selected._id : null);
            }}
          >
            <option value="">No group</option>
            {parentId && !labels.some((row) => row._id === parentId && !row.retiring) && (
              <option value={parentId}>Unavailable group</option>
            )}
            {labels
              .filter((row) => row._id !== snapshot?._id && !row.retiring)
              .map((row) => (
                <option key={row._id} value={row._id}>
                  {row.name}
                </option>
              ))}
          </select>
        </SummonField>
        <div className="flex gap-2">
          <Button type="submit" loading={pending}>
            Save label
          </Button>
          <Button variant="secondary" onClick={onDone}>
            Cancel
          </Button>
        </div>
      </fieldset>
      {error && (
        <p role="alert" className="text-14 text-danger-primary">
          {error}
        </p>
      )}
    </form>
  );
}
function RemoveLabel({ label, onDone }: { label: Doc<"taskLabels">; onDone: () => void }) {
  const [snapshot] = useState(label),
    [pending, setPending] = useState(false),
    [error, setError] = useState("");
  const begin = useMutation(api.tasks.label_removal.begin);
  return (
    <div className="space-y-3 rounded-md border border-subtle-1 p-3">
      <p className="text-14">
        Delete {snapshot.name} and its child labels? This removes them from tasks, drafts, documents and saved-view
        filters. Once cleanup starts, continue it to completion.
      </p>
      <div className="flex gap-2">
        <Button
          loading={pending}
          onClick={async () => {
            setPending(true);
            try {
              await begin({ labelId: snapshot._id, expectedRevision: snapshot.revision });
              onDone();
            } catch (failure) {
              setError(mutationMessage(failure));
            } finally {
              setPending(false);
            }
          }}
        >
          Prepare deletion
        </Button>
        <Button variant="secondary" disabled={pending} onClick={onDone}>
          Cancel
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-14 text-danger-primary">
          {error}
        </p>
      )}
    </div>
  );
}
function RemovalJobs({ projectId }: { projectId: Id<"projects"> }) {
  const jobs = usePaginatedQuery(api.tasks.label_removal.list, { projectId }, { initialNumItems: 10 });
  return (
    <div className="space-y-2">
      {jobs.results.map((job) => (
        <RemovalJob key={job._id} job={job} />
      ))}
      {jobs.status === "CanLoadMore" && (
        <Button variant="secondary" onClick={() => jobs.loadMore(10)}>
          Load more label deletions
        </Button>
      )}
    </div>
  );
}
function RemovalJob({ job }: { job: Doc<"labelRemovalJobs"> }) {
  const step = useMutation(api.tasks.label_removal.step),
    cancel = useMutation(api.tasks.label_removal.cancel);
  const [pending, setPending] = useState(false),
    [error, setError] = useState("");
  async function run(kind: "step" | "cancel") {
    setPending(true);
    setError("");
    try {
      if (kind === "step") await step({ jobId: job._id });
      else await cancel({ jobId: job._id });
    } catch (failure) {
      setError(mutationMessage(failure));
    } finally {
      setPending(false);
    }
  }
  return (
    <div className="space-y-2 rounded-md border border-subtle-1 p-3 text-14">
      <p>
        {job.name} · {job.status}
      </p>
      {job.status === "running" && (
        <>
          <p>
            {job.changed} references removed · Next: {job.phase}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button loading={pending} onClick={() => run("step")}>
              Continue deletion
            </Button>
            {!job.started && (
              <Button variant="secondary" disabled={pending} onClick={() => run("cancel")}>
                Cancel deletion
              </Button>
            )}
          </div>
        </>
      )}
      {error && (
        <p role="alert" className="text-danger-primary">
          {error}
        </p>
      )}
    </div>
  );
}
