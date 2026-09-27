import { useState } from "react";
import { useMutation, usePaginatedQuery } from "convex/react";
import { useSearchParams } from "react-router";
import type { Id } from "@summon/convex/data-model";
import type { FunctionReturnType } from "convex/server";
import { api } from "@summon/convex/api";
import { Button } from "@plane/propel/button";
import { mutationMessage } from "../commercial/forms";
import { selectOrderedProject } from "./order-selection";
type Project = FunctionReturnType<typeof api.projects.order.list>["page"][number];
export function OrderedProjectChooser({
  workspaceId,
  selected,
}: {
  workspaceId: Id<"workspaces">;
  selected: { identifier: string; name: string } | null;
}) {
  const { results, status, loadMore } = usePaginatedQuery(
    api.projects.order.list,
    { workspaceId },
    { initialNumItems: 20 }
  );
  const [, setParams] = useSearchParams();
  const move = useMutation(api.projects.order.move);
  const [pending, setPending] = useState(false),
    [error, setError] = useState("");
  const moveProject = (project: Project, neighbor: Project, direction: "up" | "down") => {
    setPending(true);
    setError("");
    void move({
      projectId: project._id,
      expectedRevision: project.orderRevision,
      neighborId: neighbor._id,
      expectedNeighborRevision: neighbor.orderRevision,
      direction,
    })
      .catch((failure) => setError(mutationMessage(failure)))
      .finally(() => setPending(false));
  };
  return (
    <details className="w-full min-w-0 rounded-md border border-subtle-1 bg-layer-2 sm:max-w-md">
      <summary className="cursor-pointer px-3 py-2 text-14 break-words">
        {selected ? `Project: ${selected.name}` : "Choose a project"}
      </summary>
      <div className="space-y-3 border-t border-subtle-1 p-3">
        <p className="text-12 text-secondary">Your project order is private to you.</p>
        <ul className="space-y-1">
          {results.map((project, index) => (
            <li key={project._id} className="flex min-w-0 items-center gap-2">
              <button
                type="button"
                aria-current={project.identifier === selected?.identifier ? "page" : undefined}
                className="min-w-0 flex-1 rounded px-2 py-2 text-left text-14 break-words hover:bg-layer-1 aria-[current=page]:bg-layer-1"
                onClick={(event) => {
                  setParams((current) => selectOrderedProject(current, project.identifier));
                  event.currentTarget.closest("details")?.removeAttribute("open");
                }}
              >
                {project.name}
              </button>
              <div className="flex shrink-0 gap-1">
                <Button
                  variant="secondary"
                  size="sm"
                  aria-label={`Move ${project.name} up`}
                  disabled={pending || index === 0}
                  onClick={() => moveProject(project, results[index - 1], "up")}
                >
                  ↑
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  aria-label={`Move ${project.name} down`}
                  disabled={pending || index + 1 >= results.length}
                  onClick={() => moveProject(project, results[index + 1], "down")}
                >
                  ↓
                </Button>
              </div>
            </li>
          ))}
        </ul>
        {status === "LoadingFirstPage" && <p role="status">Loading projects…</p>}
        {status === "Exhausted" && results.length === 0 && <p className="text-14 text-secondary">No active projects</p>}
        {(status === "CanLoadMore" || status === "LoadingMore") && (
          <div className="space-y-2">
            <Button variant="secondary" loading={status === "LoadingMore"} onClick={() => loadMore(20)}>
              Load more projects
            </Button>
            <p className="text-12 text-secondary">Load the next project before moving the last visible project down.</p>
          </div>
        )}
        {pending && (
          <p role="status" className="text-12">
            Saving project order…
          </p>
        )}
        {error && (
          <p role="alert" className="text-14 text-danger-primary">
            {error}
          </p>
        )}
      </div>
    </details>
  );
}
