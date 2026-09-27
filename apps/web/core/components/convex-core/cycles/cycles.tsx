import { useCycleClock } from "./use-cycle-clock";
import { FavoriteToggle } from "../favorites/toggle";
import { Component, useState } from "react";
import type { ReactNode } from "react";
import { useSearchParams } from "react-router";
import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
import { api } from "@summon/convex/api";
import { cyclePhase } from "@summon/convex/cycle-calendar";
import type { FunctionArgs, FunctionReturnType } from "convex/server";
import type { Id } from "@summon/convex/data-model";
import { Button } from "@plane/propel/button";
import { mutationMessage } from "../commercial/forms";
import { CycleForm, ProjectTimezone } from "./forms";
import { CycleTasks } from "./tasks";
type Project = FunctionReturnType<typeof api.projects.index.list>[number];
type Cycle = FunctionReturnType<typeof api.cycles.index.get>;
export function Cycles({ project }: { project: Project }) {
  const [params, setParams] = useSearchParams();
  const selected = params.get("cycle");
  const deleted = params.get("cycleView") === "trash";
  const [now, refreshClock] = useCycleClock();
  const cycles = usePaginatedQuery(api.cycles.index.list, selected ? "skip" : { projectId: project._id, deleted }, {
    initialNumItems: 30,
  });
  const [creating, setCreating] = useState(false);
  const canWrite = project.membershipRole !== "guest" && project.workspaceRole !== "guest";
  const select = (id: Id<"cycles"> | null) => {
    setCreating(false);
    setParams((current) => {
      const next = new URLSearchParams(current);
      if (id) next.set("cycle", id);
      else next.delete("cycle");
      return next;
    });
  };
  if (creating && canWrite)
    return <CycleForm projectId={project._id} cycle={null} onDone={select} onCancel={() => setCreating(false)} />;
  if (selected)
    return (
      <CycleBoundary key={selected} onBack={() => select(null)}>
        <CycleDetail
          cycleId={selected}
          project={project}
          now={now}
          onRefresh={refreshClock}
          onBack={() => select(null)}
        />
      </CycleBoundary>
    );
  return (
    <section className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-24 font-semibold">Cycles</h2>
        {canWrite && !deleted && <Button onClick={() => setCreating(true)}>New cycle</Button>}
      </header>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav aria-label="Cycle views" className="flex gap-2">
          <Button
            variant={!deleted ? "primary" : "secondary"}
            onClick={() =>
              setParams((current) => {
                const next = new URLSearchParams(current);
                next.delete("cycleView");
                return next;
              })
            }
          >
            Cycles
          </Button>
          <Button
            variant={deleted ? "primary" : "secondary"}
            onClick={() =>
              setParams((current) => {
                const next = new URLSearchParams(current);
                next.set("cycleView", "trash");
                return next;
              })
            }
          >
            Trash
          </Button>
        </nav>
        <Button variant="secondary" onClick={refreshClock}>
          Refresh phases
        </Button>
      </div>
      <ProjectTimezone projectId={project._id} />
      <ul className="divide-y divide-subtle-1">
        {cycles.results.map((cycle) => (
          <li key={cycle._id}>
            <button
              className="flex w-full flex-wrap items-center justify-between gap-3 py-4 text-left"
              onClick={() => select(cycle._id)}
            >
              <div className="min-w-0">
                <h3 className="text-16 font-medium break-words">{cycle.name}</h3>
                <p className="text-12 text-secondary">
                  {cycle.startDate && cycle.endDate ? `${cycle.startDate} → ${cycle.endDate}` : "No dates"} ·{" "}
                  {cycle.timezone}
                </p>
              </div>
              <span className="text-12 text-secondary capitalize">
                {cyclePhase(cycle, now)}
                {cycle.archived ? " · archived" : ""}
                {cycle.deleted ? " · deleted" : ""}
              </span>
            </button>
          </li>
        ))}
      </ul>
      {cycles.status === "LoadingFirstPage" && <p role="status">Loading cycles…</p>}
      {cycles.status === "Exhausted" && !cycles.results.length && (
        <p className="py-8 text-center text-14 text-secondary">{deleted ? "No deleted cycles." : "No cycles yet."}</p>
      )}
      {cycles.status === "CanLoadMore" && (
        <Button variant="secondary" onClick={() => cycles.loadMore(30)}>
          Load more cycles
        </Button>
      )}
    </section>
  );
}
function CycleDetail({
  cycleId,
  project,
  now,
  onRefresh,
  onBack,
}: {
  cycleId: string;
  project: Project;
  now: number;
  onRefresh: () => void;
  onBack: () => void;
}) {
  const [queryClock] = useState(now);
  const result = useQuery(api.cycles.index.resolve, { cycleId, now: queryClock });
  const [editing, setEditing] = useState(false);
  if (!result) return <p role="status">Opening cycle…</p>;
  const phase = cyclePhase(result, now);
  const cycle = { ...result, phase, canEdit: result.canEdit && phase !== "completed" };
  if (cycle.projectId !== project._id) return <Unavailable onBack={onBack} />;
  if (editing && cycle.canWrite)
    return (
      <CycleForm
        projectId={project._id}
        cycle={cycle}
        onDone={() => setEditing(false)}
        onCancel={() => setEditing(false)}
      />
    );
  return (
    <article className="space-y-5">
      <header className="flex flex-wrap justify-between gap-2">
        <Button variant="secondary" onClick={onBack}>
          Back to cycles
        </Button>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={onRefresh}>
            Refresh phase
          </Button>
          {!cycle.deleted && (
            <FavoriteToggle workspaceId={cycle.workspaceId} target={{ type: "cycle", id: cycle._id }} />
          )}
          {cycle.canEdit && <Button onClick={() => setEditing(true)}>Edit cycle</Button>}
        </div>
      </header>
      <div>
        <h2 className="text-24 font-semibold break-words">{cycle.name}</h2>
        <p className="mt-2 text-14 text-secondary capitalize">
          {cycle.phase}
          {cycle.archived ? " · archived" : ""}
          {cycle.deleted ? " · deleted" : ""}
        </p>
      </div>
      <dl className="grid gap-3 text-14 sm:grid-cols-3">
        <div>
          <dt className="text-12 text-secondary">Start date</dt>
          <dd>{cycle.startDate ?? "Not scheduled"}</dd>
        </div>
        <div>
          <dt className="text-12 text-secondary">End date</dt>
          <dd>{cycle.endDate ?? "Not scheduled"}</dd>
        </div>
        <div>
          <dt className="text-12 text-secondary">Cycle timezone</dt>
          <dd>{cycle.timezone}</dd>
        </div>
      </dl>
      {cycle.description && <p className="text-14 break-words whitespace-pre-wrap">{cycle.description}</p>}
      <Lifecycle cycle={cycle} />
      {!cycle.deleted && <CycleTasks cycle={cycle} />}
    </article>
  );
}
function Lifecycle({ cycle }: { cycle: Cycle }) {
  const lifecycle = useMutation(api.cycles.index.lifecycle);
  const [confirmation, setConfirmation] = useState<{
    operation: FunctionArgs<typeof api.cycles.index.lifecycle>["operation"];
    expectedUpdatedAt: number;
  } | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  if (!cycle.canWrite) return null;
  const choose = (operation: FunctionArgs<typeof api.cycles.index.lifecycle>["operation"]) => {
    setError("");
    setConfirmation({ operation, expectedUpdatedAt: cycle.updatedAt });
  };
  return (
    <section className="space-y-3 border-b border-subtle-1 pb-4">
      {confirmation ? (
        <div className="space-y-3">
          <p className="text-14">
            {confirmation.operation === "delete"
              ? "Move this cycle to Trash? Assigned tasks remain in the project."
              : confirmation.operation === "restore"
                ? "Restore this cycle and its remaining task memberships? Its dates must still fit the project schedule."
                : `${confirmation.operation === "archive" ? "Archive" : "Unarchive"} this cycle?`}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              loading={pending}
              onClick={async () => {
                setPending(true);
                setError("");
                try {
                  await lifecycle({ cycleId: cycle._id, ...confirmation });
                  setConfirmation(null);
                } catch (failure) {
                  setError(mutationMessage(failure));
                } finally {
                  setPending(false);
                }
              }}
            >
              Confirm {confirmation.operation}
            </Button>
            <Button variant="secondary" disabled={pending} onClick={() => setConfirmation(null)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {cycle.deleted ? (
            cycle.canDelete && (
              <Button variant="secondary" onClick={() => choose("restore")}>
                Restore cycle
              </Button>
            )
          ) : (
            <>
              {cycle.archived ? (
                <Button variant="secondary" onClick={() => choose("unarchive")}>
                  Unarchive cycle
                </Button>
              ) : (
                cycle.phase === "completed" && (
                  <Button variant="secondary" onClick={() => choose("archive")}>
                    Archive cycle
                  </Button>
                )
              )}
              {cycle.canDelete && (
                <Button variant="secondary" onClick={() => choose("delete")}>
                  Move cycle to Trash
                </Button>
              )}
            </>
          )}
        </div>
      )}
      {error && (
        <p role="alert" className="text-14 text-danger-primary">
          {error}
        </p>
      )}
    </section>
  );
}
function Unavailable({ onBack }: { onBack: () => void }) {
  return (
    <section className="space-y-3">
      <h2 className="text-20 font-semibold">This cycle is unavailable</h2>
      <p role="alert" className="text-14 text-secondary">
        Check the project and your current access.
      </p>
      <Button variant="secondary" onClick={onBack}>
        Back to cycles
      </Button>
    </section>
  );
}
class CycleBoundary extends Component<{ children: ReactNode; onBack: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? <Unavailable onBack={this.props.onBack} /> : this.props.children;
  }
}
