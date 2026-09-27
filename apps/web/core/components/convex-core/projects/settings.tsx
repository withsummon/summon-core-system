import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import type { Id } from "@summon/convex/data-model";
import { api } from "@summon/convex/api";
import { Button } from "@plane/propel/button";
import { Input } from "@plane/propel/input";
import { SummonField } from "@/components/summon/forms";
import { ProjectTimezone } from "../cycles/forms";
import { mutationMessage } from "../commercial/forms";
type Settings = FunctionReturnType<typeof api.projects.settings.get>;
export function ProjectSettings({ projectId, onArchived }: { projectId: Id<"projects">; onArchived: () => void }) {
  const settings = useQuery(api.projects.settings.get, { projectId });
  const [editing, setEditing] = useState(false);
  if (!settings) return <p role="status">Loading project settings…</p>;
  return (
    <section className="max-w-3xl space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-24 font-semibold">Project settings</h2>
        {settings.canManage && !editing && <Button onClick={() => setEditing(true)}>Edit project</Button>}
      </header>
      <div className="space-y-1">
        <p className="text-12 text-secondary">Identifier</p>
        <p className="text-14 font-medium">{settings.identifier}</p>
        <p className="text-12 text-secondary">The identifier cannot be changed.</p>
      </div>
      {editing && settings.canManage ? (
        <MetadataForm projectId={projectId} initial={settings} onClose={() => setEditing(false)} />
      ) : (
        <dl className="space-y-4">
          <div>
            <dt className="text-12 text-secondary">Name</dt>
            <dd className="text-16 break-words">{settings.name}</dd>
          </div>
          <div>
            <dt className="text-12 text-secondary">Description</dt>
            <dd className="text-14 break-words whitespace-pre-wrap">{settings.description || "No description"}</dd>
          </div>
        </dl>
      )}
      <div className="border-t border-subtle-1 pt-4">
        <h3 className="mb-3 text-16 font-medium">Timezone</h3>
        <ProjectTimezone projectId={projectId} />
      </div>
      {settings.canManage && (
        <ArchiveProject projectId={projectId} revision={settings.revision} onArchived={onArchived} />
      )}
    </section>
  );
}
function MetadataForm({
  projectId,
  initial,
  onClose,
}: {
  projectId: Id<"projects">;
  initial: Settings;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState({
    name: initial.name,
    description: initial.description,
    expectedRevision: initial.revision,
  });
  const save = useMutation(api.projects.settings.save);
  const [pending, setPending] = useState(false),
    [error, setError] = useState("");
  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setPending(true);
        setError("");
        try {
          await save({ projectId, ...draft });
          onClose();
        } catch (failure) {
          setError(mutationMessage(failure));
        } finally {
          setPending(false);
        }
      }}
    >
      <SummonField label="Project name">
        <Input
          required
          maxLength={120}
          value={draft.name}
          onChange={(e) => setDraft({ ...draft, name: e.target.value })}
        />
      </SummonField>
      <SummonField label="Project description" htmlFor="project-description">
        <textarea
          id="project-description"
          rows={5}
          maxLength={20000}
          className="w-full rounded-md border border-subtle-1 bg-layer-2 p-3 text-14"
          value={draft.description}
          onChange={(e) => setDraft({ ...draft, description: e.target.value })}
        />
      </SummonField>
      {error && (
        <p role="alert" className="text-14 text-danger-primary">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <Button type="submit" loading={pending}>
          Save project
        </Button>
        <Button variant="secondary" disabled={pending} onClick={onClose}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
function ArchiveProject({
  projectId,
  revision,
  onArchived,
}: {
  projectId: Id<"projects">;
  revision: number;
  onArchived: () => void;
}) {
  const save = useMutation(api.projects.settings.setArchived);
  const [captured, setCaptured] = useState<number | null>(null),
    [pending, setPending] = useState(false),
    [error, setError] = useState("");
  return (
    <section className="space-y-3 border-t border-subtle-1 pt-4">
      <h3 className="text-16 font-medium">Archive project</h3>
      <p className="text-14 text-secondary">
        Archiving keeps project records and hides tasks, cycles and modules until an administrator restores it.
        Documents retain their existing access.
      </p>
      {captured === null ? (
        <Button
          variant="secondary"
          onClick={() => {
            setError("");
            setCaptured(revision);
          }}
        >
          Archive project
        </Button>
      ) : (
        <div className="space-y-3">
          <p className="text-14">Archive this project and return to archived projects?</p>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              loading={pending}
              onClick={async () => {
                setPending(true);
                setError("");
                try {
                  await save({ projectId, archived: true, expectedRevision: captured });
                  onArchived();
                } catch (failure) {
                  setError(mutationMessage(failure));
                } finally {
                  setPending(false);
                }
              }}
            >
              Confirm archive
            </Button>
            <Button variant="secondary" disabled={pending} onClick={() => setCaptured(null)}>
              Cancel
            </Button>
          </div>
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
