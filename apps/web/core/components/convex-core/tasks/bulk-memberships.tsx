import { useState } from "react";
import { useMutation, usePaginatedQuery } from "convex/react";
import { api } from "@summon/convex/api";
import { cyclePhase } from "@summon/convex/cycle-calendar";
import type { Id, Doc } from "@summon/convex/data-model";
import type { FunctionArgs } from "convex/server";
import { Button } from "@plane/propel/button";
import { SummonField } from "@/components/summon/forms";
import { selectClass, mutationMessage } from "../commercial/forms";
type Target = FunctionArgs<typeof api.tasks.bulk_memberships.change>["target"] & { name: string };
export function BulkMemberships({
  projectId,
  tasks,
  onClose,
  onSaved,
}: {
  projectId: Id<"projects">;
  tasks: Pick<Doc<"tasks">, "_id" | "updatedAt" | "title" | "sequence">[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [snapshot] = useState(tasks);
  const [kind, setKind] = useState<"cycle" | "module">("cycle");
  const [target, setTarget] = useState<Target | null>(null);
  const [assigned, setAssigned] = useState(true);
  const [pending, setPending] = useState(false),
    [error, setError] = useState("");
  const cycles = usePaginatedQuery(api.cycles.index.list, kind === "cycle" ? { projectId, deleted: false } : "skip", {
    initialNumItems: 50,
  });
  const modules = usePaginatedQuery(
    api.modules.index.list,
    kind === "module" ? { projectId, deleted: false } : "skip",
    { initialNumItems: 50 }
  );
  const change = useMutation(api.tasks.bulk_memberships.change);
  const choices = kind === "cycle" ? cycles : modules;
  return (
    <form
      className="min-w-0 space-y-4 border-t border-subtle-1 pt-4"
      onSubmit={async (event) => {
        event.preventDefault();
        if (!target) return;
        setPending(true);
        setError("");
        try {
          const { name: _name, ...selection } = target;
          await change({
            projectId,
            tasks: snapshot.map((task) => ({ taskId: task._id, expectedUpdatedAt: task.updatedAt })),
            target: selection,
            assigned,
          });
          onSaved();
        } catch (cause) {
          setError(mutationMessage(cause));
        } finally {
          setPending(false);
        }
      }}
    >
      <h3 className="text-16 font-medium">
        Change cycle or module for {snapshot.length} {snapshot.length === 1 ? "task" : "tasks"}
      </h3>
      <ul className="max-h-40 overflow-y-auto text-14">
        {snapshot.map((task) => (
          <li key={task._id}>
            #{task.sequence} · {task.title}
          </li>
        ))}
      </ul>
      <fieldset disabled={pending} className="min-w-0 space-y-3">
        <SummonField label="Membership type" htmlFor="bulk-membership-kind">
          <select
            id="bulk-membership-kind"
            className={selectClass}
            value={kind}
            onChange={(event) => {
              if (event.target.value === "cycle" || event.target.value === "module") {
                setKind(event.target.value);
                setTarget(null);
              }
            }}
          >
            <option value="cycle">Cycle</option>
            <option value="module">Module</option>
          </select>
        </SummonField>
        <SummonField label={kind === "cycle" ? "Cycle" : "Module"} htmlFor="bulk-membership-target">
          <select
            required
            id="bulk-membership-target"
            className={selectClass}
            value={target?.id ?? ""}
            onChange={(event) => {
              if (kind === "cycle") {
                const row = cycles.results.find((item) => item._id === event.target.value);
                if (row) setTarget({ kind: "cycle", id: row._id, name: row.name, expectedUpdatedAt: row.updatedAt });
              } else {
                const row = modules.results.find((item) => item._id === event.target.value);
                if (row) setTarget({ kind: "module", id: row._id, name: row.name, expectedUpdatedAt: row.updatedAt });
              }
            }}
          >
            <option value="">Choose {kind}</option>
            {target && !choices.results.some((row) => row._id === target.id) && (
              <option value={target.id}>{target.name} (previous selection)</option>
            )}
            {kind === "cycle"
              ? cycles.results
                  .filter((row) => !row.archived && cyclePhase(row) !== "completed")
                  .map((row) => (
                    <option key={row._id} value={row._id}>
                      {row.name}
                    </option>
                  ))
              : modules.results
                  .filter((row) => !row.archived)
                  .map((row) => (
                    <option key={row._id} value={row._id}>
                      {row.name}
                    </option>
                  ))}
          </select>
        </SummonField>
        {choices.status === "CanLoadMore" && (
          <Button variant="secondary" onClick={() => choices.loadMore(50)}>
            Load more {kind === "cycle" ? "cycles" : "modules"}
          </Button>
        )}
        <label className="flex gap-2 text-14">
          <input type="checkbox" checked={assigned} onChange={(event) => setAssigned(event.target.checked)} />
          {assigned ? "Assign to selected membership" : "Remove from selected membership"}
        </label>
        <p className="text-12 text-secondary">
          {kind === "cycle"
            ? "Assigning moves each task from its current cycle. Completed or archived source cycles cannot be changed here."
            : "Assigning adds this module; other module memberships stay unchanged."}{" "}
          Removing affects only the selected {kind}. All selected tasks change together.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" loading={pending} disabled={!target}>
            Apply membership change
          </Button>
          <Button variant="secondary" onClick={onClose}>
            Cancel membership change
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
