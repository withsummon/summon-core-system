import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import type { Id } from "@summon/convex/data-model";
import { api } from "@summon/convex/api";
import { Button } from "@plane/propel/button";
import { mutationMessage } from "../commercial/forms";
type Config = FunctionReturnType<typeof api.intakes.index.getConfig>;
export function IntakeSettings({ projectId }: { projectId: Id<"projects"> }) {
  const config = useQuery(api.intakes.index.getConfig, { projectId });
  const [editing, setEditing] = useState(false);
  if (!config) return <p role="status">Loading intake settings…</p>;
  return (
    <section className="space-y-3 border-t border-subtle-1 pt-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-16 font-medium">Intake</h3>
        {config.canConfigure && !editing && (
          <Button variant="secondary" onClick={() => setEditing(true)}>
            Configure intake
          </Button>
        )}
      </header>
      {editing && config.canConfigure ? (
        <ConfigForm projectId={projectId} initial={config} onClose={() => setEditing(false)} />
      ) : (
        <div className="space-y-1 text-14 text-secondary">
          <p>{config.enabled ? "Accepting new submissions" : "New submissions disabled"}</p>
          <p>
            {config.guestViewAllFeatures
              ? "Guests can view all intake submissions."
              : "Guests can view their own intake submissions."}
          </p>
        </div>
      )}
    </section>
  );
}
function ConfigForm({
  projectId,
  initial,
  onClose,
}: {
  projectId: Id<"projects">;
  initial: Config;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState({
    enabled: initial.enabled,
    guestViewAllFeatures: initial.guestViewAllFeatures,
    expectedRevision: initial.revision,
  });
  const configure = useMutation(api.intakes.index.configure);
  const [pending, setPending] = useState(false),
    [error, setError] = useState("");
  return (
    <form
      className="space-y-3"
      onSubmit={async (e) => {
        e.preventDefault();
        setPending(true);
        setError("");
        try {
          await configure({ projectId, ...draft });
          onClose();
        } catch (failure) {
          setError(mutationMessage(failure));
        } finally {
          setPending(false);
        }
      }}
    >
      <label className="flex items-start gap-2 text-14">
        <input
          type="checkbox"
          checked={draft.enabled}
          onChange={(e) => setDraft({ ...draft, enabled: e.target.checked })}
        />
        Enable intake submissions
      </label>
      <label className="flex items-start gap-2 text-14">
        <input
          type="checkbox"
          checked={draft.guestViewAllFeatures}
          onChange={(e) => setDraft({ ...draft, guestViewAllFeatures: e.target.checked })}
        />
        Allow guests to view all intake submissions
      </label>
      {error && (
        <p role="alert" className="text-14 text-danger-primary">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <Button type="submit" loading={pending}>
          Save intake settings
        </Button>
        <Button variant="secondary" disabled={pending} onClick={onClose}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
