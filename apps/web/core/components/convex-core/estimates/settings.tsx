import { Component, useState } from "react";
import type { ReactNode } from "react";
import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import type { Id } from "@summon/convex/data-model";
import { api } from "@summon/convex/api";
import { Button } from "@plane/propel/button";
import { mutationMessage } from "../commercial/forms";
import { PointForm, SystemForm } from "./forms";
import { EstimateRemoval, EstimateProgress } from "./removal";
type System = FunctionReturnType<typeof api.estimates.index.get>;
export function EstimateSettings({ projectId }: { projectId: Id<"projects"> }) {
  const [completedJob, setCompletedJob] = useState<Id<"estimateRemaps"> | null>(null);
  const data = useQuery(api.estimates.index.list, { projectId });
  const [selected, setSelected] = useState<Id<"estimateSystems"> | null>(null),
    [creating, setCreating] = useState(false);
  const [approval, setApproval] = useState<{
    systemId: Id<"estimateSystems"> | null;
    name: string;
    revision: number;
  } | null>(null);
  const [pending, setPending] = useState(false),
    [error, setError] = useState("");
  const select = useMutation(api.estimates.index.select);
  if (!data) return <p role="status">Loading estimates…</p>;
  const locked = Boolean(data.config?.jobId);
  const visibleJob = data.config?.jobId ?? completedJob;
  return (
    <section className="space-y-4 border-t border-subtle-1 pt-4">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-16 font-medium">Estimates</h3>
        {data.canWrite && !locked && (
          <Button variant="secondary" onClick={() => setCreating(true)}>
            New estimate system
          </Button>
        )}
      </header>
      {visibleJob && (
        <EstimateProgress jobId={visibleJob} canWrite={data.canWrite} onComplete={() => setCompletedJob(visibleJob)} />
      )}
      {creating && <SystemForm projectId={projectId} onClose={() => setCreating(false)} />}
      <ul className="space-y-2">
        {data.systems.map((system) => (
          <li
            key={system._id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-subtle-1 p-3"
          >
            <button type="button" className="text-left text-14 font-medium" onClick={() => setSelected(system._id)}>
              {system.name}
              {data.config?.activeSystemId === system._id ? " · Active" : ""}
            </button>
            {data.canSelect && !locked && data.config?.activeSystemId !== system._id && (
              <Button
                variant="secondary"
                onClick={() =>
                  setApproval({ systemId: system._id, name: system.name, revision: data.config?.revision ?? 0 })
                }
              >
                Use system
              </Button>
            )}
          </li>
        ))}
      </ul>
      {!data.systems.length && <p className="text-14 text-secondary">No estimate systems yet.</p>}
      {data.canSelect && !locked && data.config?.activeSystemId && (
        <Button
          variant="secondary"
          onClick={() =>
            setApproval({ systemId: null, name: "No active estimate system", revision: data.config?.revision ?? 0 })
          }
        >
          Disable estimates
        </Button>
      )}
      {approval && (
        <div className="space-y-3">
          <p className="text-14">Use {approval.name}? Existing task estimates are retained.</p>
          <div className="flex gap-2">
            <Button
              loading={pending}
              onClick={async () => {
                setPending(true);
                setError("");
                try {
                  await select({ projectId, systemId: approval.systemId, expectedRevision: approval.revision });
                  setApproval(null);
                } catch (failure) {
                  setError(mutationMessage(failure));
                } finally {
                  setPending(false);
                }
              }}
            >
              Confirm estimate system
            </Button>
            <Button variant="secondary" disabled={pending} onClick={() => setApproval(null)}>
              Cancel
            </Button>
          </div>
        </div>
      )}
      {selected && (
        <SystemBoundary key={selected} onClose={() => setSelected(null)}>
          <SystemDetail
            key={selected}
            systemId={selected}
            canWrite={data.canWrite && !locked}
            onClose={() => setSelected(null)}
          />
        </SystemBoundary>
      )}
      {error && (
        <p role="alert" className="text-14 text-danger-primary">
          {error}
        </p>
      )}
    </section>
  );
}
function SystemDetail({
  systemId,
  canWrite,
  onClose,
}: {
  systemId: Id<"estimateSystems">;
  canWrite: boolean;
  onClose: () => void;
}) {
  const system = useQuery(api.estimates.index.get, { systemId });
  const [editing, setEditing] = useState<System | null>(null),
    [pointEdit, setPointEdit] = useState<{ system: System; point?: System["points"][number] } | null>(null),
    [removal, setRemoval] = useState<{ system: System; point: System["points"][number] | null } | null>(null);
  if (!system) return <p role="status">Loading estimate system…</p>;
  return (
    <section className="space-y-3 rounded-md border border-subtle-1 p-4">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-16 font-medium">{system.name}</h4>
        <Button variant="secondary" onClick={onClose}>
          Close system
        </Button>
      </header>
      <p className="text-14 text-secondary">
        {system.type} · {system.description}
      </p>
      {editing && <SystemForm projectId={system.projectId} initial={editing} onClose={() => setEditing(null)} />}
      {pointEdit && (
        <PointForm system={pointEdit.system} initial={pointEdit.point} onClose={() => setPointEdit(null)} />
      )}
      {removal && <EstimateRemoval {...removal} onClose={() => setRemoval(null)} />}
      {canWrite && !editing && !pointEdit && !removal && (
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => setEditing(system)}>
            Edit system
          </Button>
          <Button variant="secondary" onClick={() => setPointEdit({ system })}>
            Add point
          </Button>
          <Button variant="secondary" onClick={() => setRemoval({ system, point: null })}>
            Remove system
          </Button>
        </div>
      )}
      <ul className="space-y-2">
        {system.points.map((point) => (
          <li
            key={point._id}
            className="flex flex-wrap items-center justify-between gap-2 border-t border-subtle-1 pt-2"
          >
            <div>
              <p className="text-14 font-medium">{point.value}</p>
              <p className="text-12 text-secondary">
                Order {point.key}
                {point.description ? ` · ${point.description}` : ""}
              </p>
            </div>
            {canWrite && !editing && !pointEdit && !removal && (
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => setPointEdit({ system, point })}>
                  Edit {point.value}
                </Button>
                <Button variant="secondary" onClick={() => setRemoval({ system, point })}>
                  Remove {point.value}
                </Button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

class SystemBoundary extends Component<{ children: ReactNode; onClose: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <div className="space-y-2">
        <p role="alert" className="text-14">
          This estimate system is unavailable. It may have been removed.
        </p>
        <Button variant="secondary" onClick={this.props.onClose}>
          Close system
        </Button>
      </div>
    ) : (
      this.props.children
    );
  }
}
