import { useState } from "react";
import { useMutation, usePaginatedQuery } from "convex/react";
import type { FunctionArgs, FunctionReturnType } from "convex/server";
import { api } from "@summon/convex/api";
import type { Id } from "@summon/convex/data-model";
import { Button } from "@plane/propel/button";
import { Input } from "@plane/propel/input";
import { SummonField } from "@/components/summon/forms";
import { TaskRichEditor } from "../tasks/rich-editor";
import { mutationMessage } from "../commercial/forms";
type Module = FunctionReturnType<typeof api.modules.index.get>;
const statuses = [
  "backlog",
  "planned",
  "in-progress",
  "paused",
  "completed",
  "cancelled",
] as const satisfies FunctionArgs<typeof api.modules.index.create>["status"][];
export function ModuleForm({
  projectId,
  module,
  onDone,
  onCancel,
}: {
  projectId: Id<"projects">;
  module: Module | null;
  onDone: (id: Id<"modules">) => void;
  onCancel: () => void;
}) {
  const create = useMutation(api.modules.index.create);
  const update = useMutation(api.modules.index.update);
  const [initial] = useState(module);
  const [draft, setDraft] = useState({
    name: initial?.name ?? "",
    descriptionHtml: initial?.descriptionHtml ?? "",
    status: initial?.status ?? "backlog",
    startDate: initial?.startDate ?? "",
    targetDate: initial?.targetDate ?? "",
    leadId: initial?.leadId ?? null,
  });
  const people = usePaginatedQuery(api.modules.members.choices, { projectId }, { initialNumItems: 50 });
  const leadChoices =
    initial?.lead && !people.results.some((person) => person.id === initial.lead?.id)
      ? [initial.lead, ...people.results]
      : people.results;
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  return (
    <form
      className="max-w-3xl space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setPending(true);
        setError("");
        try {
          const fields = { ...draft, startDate: draft.startDate || null, targetDate: draft.targetDate || null };
          if (initial) {
            await update({ moduleId: initial._id, expectedUpdatedAt: initial.updatedAt, ...fields });
            onDone(initial._id);
          } else onDone(await create({ projectId, ...fields }));
        } catch (failure) {
          setError(mutationMessage(failure));
        } finally {
          setPending(false);
        }
      }}
    >
      <h2 className="text-20 font-semibold">{initial ? "Edit module" : "New module"}</h2>
      <SummonField label="Module name">
        <Input
          required
          maxLength={255}
          value={draft.name}
          onChange={(e) => setDraft({ ...draft, name: e.target.value })}
        />
      </SummonField>
      <div className="grid gap-3 sm:grid-cols-2">
        <SummonField label="Module status" htmlFor="module-status">
          <select
            id="module-status"
            className="w-full rounded-md border border-subtle-1 bg-layer-2 p-2 text-14 capitalize"
            value={draft.status}
            onChange={(e) => {
              const status = statuses.find((value) => value === e.target.value);
              if (status) setDraft({ ...draft, status });
            }}
          >
            {statuses.map((status) => (
              <option key={status} value={status}>
                {status.replace("-", " ")}
              </option>
            ))}
          </select>
        </SummonField>
        <SummonField label="Module lead" htmlFor="module-lead">
          <select
            id="module-lead"
            className="w-full rounded-md border border-subtle-1 bg-layer-2 p-2 text-14"
            value={draft.leadId ?? ""}
            onChange={(e) => {
              const person = leadChoices.find((choice) => choice.id === e.target.value);
              setDraft({ ...draft, leadId: person?.id ?? null });
            }}
          >
            <option value="">No lead</option>
            {leadChoices.map((person) => (
              <option key={person.id} value={person.id}>
                {person.name ?? person.email ?? "Unnamed member"}
              </option>
            ))}
          </select>
        </SummonField>
        <SummonField label="Start date">
          <Input
            type="date"
            max={draft.targetDate || undefined}
            value={draft.startDate}
            onChange={(e) => setDraft({ ...draft, startDate: e.target.value })}
          />
        </SummonField>
        <SummonField label="Target date">
          <Input
            type="date"
            min={draft.startDate || undefined}
            value={draft.targetDate}
            onChange={(e) => setDraft({ ...draft, targetDate: e.target.value })}
          />
        </SummonField>
      </div>
      {people.status === "CanLoadMore" && (
        <Button variant="secondary" onClick={() => people.loadMore(50)}>
          Load more lead choices
        </Button>
      )}
      <p className="text-12 text-secondary">
        Start and target dates are optional independently. Lead and roster membership do not grant access.
      </p>
      <TaskRichEditor
        id={`module-form-${initial?._id ?? "new"}`}
        label="Module description"
        placeholder="Describe the module…"
        html={initial?.descriptionHtml ?? ""}
        editable={!pending}
        onChange={(descriptionHtml) => setDraft((current) => ({ ...current, descriptionHtml }))}
      />
      {error && (
        <p role="alert" className="text-14 text-danger-primary">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <Button type="submit" loading={pending}>
          Save module
        </Button>
        <Button variant="secondary" disabled={pending} onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
