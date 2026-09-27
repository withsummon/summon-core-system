import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@summon/convex/api";
import type { Doc, Id } from "@summon/convex/data-model";
import { Button } from "@plane/propel/button";
import { Input } from "@plane/propel/input";
import { SummonField } from "@/components/summon/forms";
import { field, mutationMessage, selectClass } from "../commercial/forms";
import { statusOptions, taskStatusOptions } from "./options";

export function ProjectTaxonomy({ projectId }: { projectId: Id<"projects"> }) {
  const states = useQuery(api.tasks.states.list, { projectId });
  const labels = useQuery(api.tasks.labels.list, { projectId });
  const [state, setState] = useState<Doc<"taskStates"> | null | undefined>();
  const [label, setLabel] = useState<Doc<"taskLabels"> | null | undefined>();
  return (
    <details className="rounded-lg border border-subtle-1 p-4">
      <summary className="cursor-pointer text-14 font-medium">Project states & labels</summary>
      <div className="mt-4 grid gap-5 md:grid-cols-2">
        <section className="space-y-3">
          <h3 className="text-14 font-medium">Workflow states</h3>
          {states?.map((item) => (
            <button className="block text-14" key={item._id} onClick={() => setState(item)}>
              {item.name} · {taskStatusOptions[item.status].label}
              {item.isDefault ? " · Default" : ""}
            </button>
          ))}
          <Button variant="secondary" onClick={() => setState(null)}>
            New state
          </Button>
          {state !== undefined && (
            <StateForm
              key={state?._id ?? "new"}
              projectId={projectId}
              state={state}
              onDone={() => setState(undefined)}
            />
          )}
        </section>
        <section className="space-y-3">
          <h3 className="text-14 font-medium">Labels</h3>
          {labels?.map((item) => (
            <button className="block text-14" key={item._id} onClick={() => setLabel(item)}>
              <span style={{ color: item.color }} aria-hidden>
                ●{" "}
              </span>
              {item.name}
            </button>
          ))}
          <Button variant="secondary" onClick={() => setLabel(null)}>
            New label
          </Button>
          {label !== undefined && (
            <LabelForm
              key={label?._id ?? "new"}
              projectId={projectId}
              label={label}
              onDone={() => setLabel(undefined)}
            />
          )}
        </section>
      </div>
    </details>
  );
}
function TaxonomyFields({
  record,
}: {
  record: { name: string; description: string; color: string; sortOrder: number } | null;
}) {
  return (
    <>
      <SummonField label="Name">
        <Input name="name" defaultValue={record?.name} required maxLength={255} />
      </SummonField>
      <SummonField label="Description">
        <Input name="description" defaultValue={record?.description} maxLength={10000} />
      </SummonField>
      <div className="grid grid-cols-2 gap-3">
        <SummonField label="Color">
          <Input type="color" name="color" defaultValue={record?.color || "#6366f1"} />
        </SummonField>
        <SummonField label="Sort order">
          <Input type="number" name="sortOrder" step="any" defaultValue={record?.sortOrder ?? 0} required />
        </SummonField>
      </div>
    </>
  );
}
function StateForm({
  projectId,
  state,
  onDone,
}: {
  projectId: Id<"projects">;
  state: Doc<"taskStates"> | null;
  onDone: () => void;
}) {
  const save = useMutation(api.tasks.states.save);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  return (
    <form
      className="space-y-3"
      onSubmit={async (event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        const status = statusOptions.find((option) => option.value === field(form, "status"));
        if (!status) return;
        setPending(true);
        setError("");
        try {
          await save({
            projectId,
            stateId: state?._id,
            data: {
              name: field(form, "name"),
              description: field(form, "description"),
              color: field(form, "color"),
              sortOrder: Number(field(form, "sortOrder")),
              status: status.value,
              isDefault: form.has("default"),
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
        <TaxonomyFields record={state} />
        <SummonField label="Status group" htmlFor="state-group">
          <select id="state-group" name="status" className={selectClass} defaultValue={state?.status ?? "todo"}>
            {statusOptions.map((option) => (
              <option value={option.value} key={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </SummonField>
        <label className="flex gap-2 text-14">
          <input type="checkbox" name="default" defaultChecked={state?.isDefault} />
          Default for new tasks
        </label>
        <div className="flex gap-2">
          <Button type="submit" loading={pending}>
            Save state
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
function LabelForm({
  projectId,
  label,
  onDone,
}: {
  projectId: Id<"projects">;
  label: Doc<"taskLabels"> | null;
  onDone: () => void;
}) {
  const save = useMutation(api.tasks.labels.save);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  return (
    <form
      className="space-y-3"
      onSubmit={async (event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        setPending(true);
        setError("");
        try {
          await save({
            projectId,
            labelId: label?._id,
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
        <TaxonomyFields record={label} />
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
