import { useState } from "react";
import { useSearchParams } from "react-router";
import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import type { Id } from "@summon/convex/data-model";
import { api } from "@summon/convex/api";
import { Button } from "@plane/propel/button";
import { FavoriteControl, SavedFilters, TaskResultRows, ViewBoundary, ViewLifecycleControl } from "./saved-views";
import { WorkspaceViewForm } from "./workspace-form";
type Workspace = FunctionReturnType<typeof api.workspaces.index.list>[number];
type Detail = FunctionReturnType<typeof api.savedViews.workspace.get>;
export function WorkspaceViews({ workspace }: { workspace: Workspace }) {
  const [params, setParams] = useSearchParams();
  const selected = params.get("savedView"),
    tab =
      params.get("savedViewTab") === "trash"
        ? "trash"
        : params.get("savedViewTab") === "favorites"
          ? "favorites"
          : "all";
  const [creating, setCreating] = useState(false);
  const access = useQuery(api.savedViews.workspace.access, { workspaceId: workspace._id });
  const all = usePaginatedQuery(
    api.savedViews.workspace.list,
    selected || creating || tab === "favorites" ? "skip" : { workspaceId: workspace._id, deleted: tab === "trash" },
    { initialNumItems: 30 }
  );
  const favorites = usePaginatedQuery(
    api.savedViews.workspace.favorites,
    selected || creating || tab !== "favorites" ? "skip" : { workspaceId: workspace._id },
    { initialNumItems: 30 }
  );
  const rows = tab === "favorites" ? favorites : all;
  const select = (id: Id<"savedViews"> | null) => {
    setCreating(false);
    setParams((current) => {
      const next = new URLSearchParams(current);
      if (id) next.set("savedView", id);
      else next.delete("savedView");
      return next;
    });
  };
  if (creating && access?.canCreate)
    return (
      <WorkspaceViewForm
        workspaceId={workspace._id}
        initial={null}
        onDone={select}
        onCancel={() => setCreating(false)}
      />
    );
  if (selected)
    return (
      <ViewBoundary key={selected} onBack={() => select(null)}>
        <WorkspaceViewDetail
          workspace={workspace}
          rawId={selected}
          onBack={() => select(null)}
          onLifecycle={(deleted) =>
            setParams((current) => {
              const next = new URLSearchParams(current);
              next.delete("savedView");
              next.set("savedViewTab", deleted ? "trash" : "all");
              return next;
            })
          }
        />
      </ViewBoundary>
    );
  return (
    <section className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-12 text-secondary">{workspace.name}</p>
          <h1 className="text-28 font-semibold">Workspace views</h1>
          <p className="mt-1 text-14 text-secondary">Saved task filters across accessible projects.</p>
        </div>
        {access?.canCreate && <Button onClick={() => setCreating(true)}>Create workspace view</Button>}
      </header>
      <nav aria-label="Workspace view lists" className="flex flex-wrap gap-2">
        {(
          [
            { value: "all", label: "All views" },
            { value: "favorites", label: "Favorites" },
            { value: "trash", label: "Trash" },
          ] as const
        ).map((item) => (
          <Button
            key={item.value}
            variant={tab === item.value ? "primary" : "secondary"}
            onClick={() =>
              setParams((current) => {
                const next = new URLSearchParams(current);
                next.set("savedViewTab", item.value);
                return next;
              })
            }
          >
            {item.label}
          </Button>
        ))}
      </nav>
      <ul className="divide-y divide-subtle-1">
        {rows.results.map((row) => (
          <li key={row.view._id} className="flex items-center justify-between gap-3 py-4">
            <button className="min-w-0 flex-1 text-left" onClick={() => select(row.view._id)}>
              <span className="block text-16 font-medium break-words">{row.view.name}</span>
              {row.view.description && (
                <span className="mt-1 line-clamp-2 block text-14 break-words text-secondary">
                  {row.view.description}
                </span>
              )}
            </button>
            <WorkspaceFavorite detail={row} />
          </li>
        ))}
      </ul>
      {rows.status === "LoadingFirstPage" && <p role="status">Loading workspace views…</p>}
      {rows.status === "Exhausted" && !rows.results.length && (
        <p className="text-14 text-secondary">No workspace views available in this list.</p>
      )}
      {rows.status === "CanLoadMore" && (
        <Button variant="secondary" onClick={() => rows.loadMore(30)}>
          Load more views
        </Button>
      )}
    </section>
  );
}
function WorkspaceViewDetail({
  workspace,
  rawId,
  onBack,
  onLifecycle,
}: {
  workspace: Workspace;
  rawId: string;
  onBack: () => void;
  onLifecycle: (deleted: boolean) => void;
}) {
  const detail = useQuery(api.savedViews.workspace.resolve, { viewId: rawId });
  const change = useMutation(api.savedViews.workspace.lifecycle);
  const [editing, setEditing] = useState(false);
  if (!detail) return <p role="status">Opening workspace view…</p>;
  if (detail.view.workspaceId !== workspace._id || detail.view.projectId !== null)
    throw new Error("View belongs to another scope");
  if (editing && detail.canEdit)
    return (
      <WorkspaceViewForm
        workspaceId={workspace._id}
        initial={detail}
        onDone={() => setEditing(false)}
        onCancel={() => setEditing(false)}
      />
    );
  return (
    <article className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <Button variant="secondary" onClick={onBack}>
          Back to workspace views
        </Button>
        <div className="flex flex-wrap gap-2">
          <WorkspaceFavorite detail={detail} />
          {detail.canEdit && (
            <Button variant="secondary" onClick={() => setEditing(true)}>
              Edit view
            </Button>
          )}
        </div>
      </header>
      <div>
        <p className="text-12 text-secondary">{workspace.name} · Workspace view</p>
        <h2 className="text-24 font-semibold break-words">{detail.view.name}</h2>
        {detail.view.description && (
          <p className="mt-2 text-14 break-words whitespace-pre-wrap text-secondary">{detail.view.description}</p>
        )}
      </div>
      <SavedFilters detail={detail} />
      {detail.view.deletedAt === null ? (
        <WorkspaceResults key={`${detail.view._id}:${detail.view.updatedAt}`} viewId={detail.view._id} />
      ) : (
        <p className="text-14 text-secondary">Removed view. Restore its definition to open matching tasks.</p>
      )}
      <ViewLifecycleControl detail={detail} onDone={onLifecycle} onChange={change} />
    </article>
  );
}
function WorkspaceFavorite({ detail }: { detail: Pick<Detail, "view" | "canFavorite" | "isFavorite"> }) {
  const save = useMutation(api.savedViews.workspace.favorite);
  return <FavoriteControl detail={detail} onChange={(favorite) => save({ viewId: detail.view._id, favorite })} />;
}
function WorkspaceResults({ viewId }: { viewId: Id<"savedViews"> }) {
  const rows = usePaginatedQuery(api.savedViews.workspace.results, { viewId }, { initialNumItems: 50 });
  return (
    <section className="space-y-3">
      <header>
        <h3 className="text-16 font-medium">Matching tasks</h3>
        <p className="text-12 text-secondary">Newest created first · accessible projects</p>
      </header>
      <TaskResultRows rows={rows.results} />
      {rows.status === "LoadingFirstPage" && <p role="status">Loading matching tasks…</p>}
      {rows.status === "Exhausted" && !rows.results.length && (
        <p className="text-14 text-secondary">No matching tasks available.</p>
      )}
      {rows.status === "CanLoadMore" && (
        <Button variant="secondary" onClick={() => rows.loadMore(50)}>
          Load more matching tasks
        </Button>
      )}
    </section>
  );
}
