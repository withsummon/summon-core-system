import { useState } from "react";
import { useMutation, usePaginatedQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import type { Id } from "@summon/convex/data-model";
import { api } from "@summon/convex/api";
import { Button } from "@plane/propel/button";
import { SummonField } from "@/components/summon/forms";
import { mutationMessage } from "../commercial/forms";
type Module = FunctionReturnType<typeof api.modules.index.get>;
export function ModuleMembers({ module }: { module: Module }) {
  const people = usePaginatedQuery(api.modules.members.list, { moduleId: module._id }, { initialNumItems: 50 });
  const [adding, setAdding] = useState(false);
  return (
    <section className="space-y-3">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-20 font-medium">Members</h3>
        {module.canEdit && (
          <Button variant="secondary" onClick={() => setAdding(true)}>
            Add member
          </Button>
        )}
      </header>
      {adding && module.canWrite && <AddMember module={module} onClose={() => setAdding(false)} />}
      <ul className="divide-y divide-subtle-1">
        {people.results.map((person) => (
          <li key={person.userId} className="flex flex-wrap items-center justify-between gap-3 py-2">
            <span className="min-w-0 text-14 break-words">{person.name ?? person.email ?? "Unnamed member"}</span>
            {module.canEdit && <RemoveMember module={module} userId={person.userId} />}
          </li>
        ))}
      </ul>
      {people.status === "LoadingFirstPage" && <p role="status">Loading module members…</p>}
      {people.status === "Exhausted" && !people.results.length && (
        <p className="text-14 text-secondary">No module members.</p>
      )}
      {people.status === "CanLoadMore" && (
        <Button variant="secondary" onClick={() => people.loadMore(50)}>
          Load more members
        </Button>
      )}
    </section>
  );
}
function AddMember({ module, onClose }: { module: Module; onClose: () => void }) {
  const [initial] = useState(module);
  const people = usePaginatedQuery(
    api.modules.members.choices,
    { projectId: module.projectId },
    { initialNumItems: 50 }
  );
  const [userId, setUserId] = useState<Id<"users"> | null>(null);
  const save = useMutation(api.modules.members.set);
  const [pending, setPending] = useState(false),
    [error, setError] = useState("");
  return (
    <form
      className="max-w-xl space-y-3 rounded-xl border border-subtle-1 p-4"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!userId) return;
        setPending(true);
        setError("");
        try {
          await save({ moduleId: initial._id, userId, assigned: true, expectedUpdatedAt: initial.updatedAt });
          onClose();
        } catch (failure) {
          setError(mutationMessage(failure));
        } finally {
          setPending(false);
        }
      }}
    >
      <SummonField label="Module member" htmlFor="module-member">
        <select
          id="module-member"
          required
          className="w-full rounded-md border border-subtle-1 bg-layer-2 p-2 text-14"
          value={userId ?? ""}
          onChange={(e) => setUserId(people.results.find((person) => person.id === e.target.value)?.id ?? null)}
        >
          <option value="">Choose member</option>
          {people.results.map((person) => (
            <option key={person.id} value={person.id}>
              {person.name ?? person.email ?? "Unnamed member"}
            </option>
          ))}
        </select>
      </SummonField>
      {people.status === "CanLoadMore" && (
        <Button variant="secondary" onClick={() => people.loadMore(50)}>
          Load more member choices
        </Button>
      )}
      <div className="flex gap-2">
        <Button type="submit" loading={pending} disabled={!userId}>
          Confirm member
        </Button>
        <Button variant="secondary" disabled={pending} onClick={onClose}>
          Cancel
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-14 text-danger-primary">
          {error}
        </p>
      )}
    </form>
  );
}
function RemoveMember({ module, userId }: { module: Module; userId: Id<"users"> }) {
  const save = useMutation(api.modules.members.set);
  const [version, setVersion] = useState<number | null>(null),
    [pending, setPending] = useState(false),
    [error, setError] = useState("");
  return (
    <div className="space-y-2">
      {version === null ? (
        <Button
          variant="secondary"
          onClick={() => {
            setError("");
            setVersion(module.updatedAt);
          }}
        >
          Remove member
        </Button>
      ) : (
        <div className="flex gap-2">
          <Button
            variant="secondary"
            loading={pending}
            onClick={async () => {
              setPending(true);
              setError("");
              try {
                await save({ moduleId: module._id, userId, assigned: false, expectedUpdatedAt: version });
                setVersion(null);
              } catch (failure) {
                setError(mutationMessage(failure));
              } finally {
                setPending(false);
              }
            }}
          >
            Confirm removal
          </Button>
          <Button variant="secondary" disabled={pending} onClick={() => setVersion(null)}>
            Cancel
          </Button>
        </div>
      )}
      {error && (
        <p role="alert" className="text-12 text-danger-primary">
          {error}
        </p>
      )}
    </div>
  );
}
