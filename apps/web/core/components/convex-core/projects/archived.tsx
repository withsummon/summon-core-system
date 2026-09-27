import { LeaveMembership } from "../memberships/leave";
import { useState } from "react";
import { useMutation, usePaginatedQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import type { Id } from "@summon/convex/data-model";
import { api } from "@summon/convex/api";
import { Button } from "@plane/propel/button";
import { mutationMessage } from "../commercial/forms";
type Archived = FunctionReturnType<typeof api.projects.settings.archived>["page"][number];
export function ArchivedProjects({
  workspaceId,
  onRestored,
}: {
  workspaceId: Id<"workspaces">;
  onRestored: (identifier: string) => void;
}) {
  const projects = usePaginatedQuery(api.projects.settings.archived, { workspaceId }, { initialNumItems: 50 });
  return (
    <section className="space-y-4">
      <h2 className="text-24 font-semibold">Archived projects</h2>
      <ul className="divide-y divide-subtle-1">
        {projects.results.map((project) => (
          <li key={project._id} className="flex flex-wrap items-center justify-between gap-3 py-4">
            <div className="min-w-0">
              <p className="text-12 text-secondary">{project.identifier}</p>
              <h3 className="text-16 font-medium break-words">{project.name}</h3>
            </div>
            <LeaveMembership scope={{ kind: "project", id: project._id, name: project.name }} />
            {project.canRestore ? (
              <RestoreProject project={project} onRestored={onRestored} />
            ) : (
              <span className="text-12 text-secondary">A project administrator can restore this project.</span>
            )}
          </li>
        ))}
      </ul>
      {projects.status === "LoadingFirstPage" && <p role="status">Loading archived projects…</p>}
      {projects.status === "Exhausted" && !projects.results.length && (
        <p className="text-14 text-secondary">No archived projects available to you.</p>
      )}
      {projects.status === "CanLoadMore" && (
        <Button variant="secondary" onClick={() => projects.loadMore(50)}>
          Load more archived projects
        </Button>
      )}
    </section>
  );
}
function RestoreProject({ project, onRestored }: { project: Archived; onRestored: (identifier: string) => void }) {
  const save = useMutation(api.projects.settings.setArchived);
  const [captured, setCaptured] = useState<number | null>(null),
    [pending, setPending] = useState(false),
    [error, setError] = useState("");
  return (
    <div className="space-y-2">
      {captured === null ? (
        <Button
          variant="secondary"
          onClick={() => {
            setError("");
            setCaptured(project.revision);
          }}
        >
          Restore project
        </Button>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button
            loading={pending}
            onClick={async () => {
              setPending(true);
              setError("");
              try {
                await save({ projectId: project._id, archived: false, expectedRevision: captured });
                onRestored(project.identifier);
              } catch (failure) {
                setError(mutationMessage(failure));
              } finally {
                setPending(false);
              }
            }}
          >
            Confirm restore
          </Button>
          <Button variant="secondary" disabled={pending} onClick={() => setCaptured(null)}>
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
