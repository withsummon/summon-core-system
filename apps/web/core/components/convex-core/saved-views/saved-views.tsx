import { Component, useState } from "react";
import type { ReactNode } from "react";
import { Link, useSearchParams } from "react-router";
import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import type { Id } from "@summon/convex/data-model";
import { api } from "@summon/convex/api";
import { Button } from "@plane/propel/button";
import { mutationMessage } from "../commercial/forms";
import { taskStatusOptions } from "../tasks/options";
import { SavedViewForm } from "./form";
type Project = FunctionReturnType<typeof api.projects.index.list>[number];
type Detail = FunctionReturnType<typeof api.savedViews.index.get>;
export function SavedViews({ project }: { project: Project }) {
  const [params, setParams] = useSearchParams();
  const selected = params.get("savedView");
  const tab =
    params.get("savedViewTab") === "trash" ? "trash" : params.get("savedViewTab") === "favorites" ? "favorites" : "all";
  const [creating, setCreating] = useState(false);
  const access = useQuery(api.savedViews.index.access, { projectId: project._id });
  const all = usePaginatedQuery(
    api.savedViews.index.list,
    selected || creating || tab === "favorites" ? "skip" : { projectId: project._id, deleted: tab === "trash" },
    { initialNumItems: 30 }
  );
  const favorites = usePaginatedQuery(
    api.savedViews.favorites.list,
    selected || creating || tab !== "favorites" ? "skip" : { projectId: project._id },
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
    return <SavedViewForm projectId={project._id} initial={null} onDone={select} onCancel={() => setCreating(false)} />;
  if (selected)
    return (
      <ViewBoundary key={selected} onBack={() => select(null)}>
        <SavedViewDetail
          project={project}
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
          <h2 className="text-24 font-semibold">Saved views</h2>
          <p className="mt-1 text-14 text-secondary">Open a saved set of project task filters.</p>
        </div>
        {access?.canCreate && <Button onClick={() => setCreating(true)}>Create view</Button>}
      </header>
      <nav aria-label="Saved view lists" className="flex flex-wrap gap-2">
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
            <Favorite detail={row} />
          </li>
        ))}
      </ul>
      {rows.status === "LoadingFirstPage" && <p role="status">Loading saved views…</p>}
      {rows.status === "Exhausted" && !rows.results.length && (
        <p className="text-14 text-secondary">No saved views available in this list.</p>
      )}
      {rows.status === "CanLoadMore" && (
        <Button variant="secondary" onClick={() => rows.loadMore(30)}>
          Load more views
        </Button>
      )}
    </section>
  );
}
function SavedViewDetail({
  project,
  rawId,
  onBack,
  onLifecycle,
}: {
  project: Project;
  rawId: string;
  onBack: () => void;
  onLifecycle: (deleted: boolean) => void;
}) {
  const detail = useQuery(api.savedViews.index.resolve, { viewId: rawId });
  const [editing, setEditing] = useState(false);
  if (!detail) return <p role="status">Opening saved view…</p>;
  if (detail.view.projectId !== project._id) throw new Error("Saved view belongs to another project");
  if (editing && detail.canEdit)
    return (
      <SavedViewForm
        projectId={project._id}
        initial={detail}
        onDone={() => setEditing(false)}
        onCancel={() => setEditing(false)}
      />
    );
  return (
    <article className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <Button variant="secondary" onClick={onBack}>
          Back to saved views
        </Button>
        <div className="flex flex-wrap gap-2">
          <Favorite detail={detail} />
          {detail.canEdit && (
            <Button variant="secondary" onClick={() => setEditing(true)}>
              Edit view
            </Button>
          )}
        </div>
      </header>
      <div>
        <h2 className="text-24 font-semibold break-words">{detail.view.name}</h2>
        {detail.view.description && (
          <p className="mt-2 text-14 break-words whitespace-pre-wrap text-secondary">{detail.view.description}</p>
        )}
      </div>
      <SavedFilters detail={detail} />
      {detail.view.deletedAt === null ? (
        <Results key={`${detail.view._id}:${detail.view.updatedAt}`} viewId={detail.view._id} project={project} />
      ) : (
        <p className="text-14 text-secondary">Removed view. Restore its definition to open matching tasks.</p>
      )}
      <ViewLifecycle detail={detail} onDone={onLifecycle} />
    </article>
  );
}
function selectionNames(items: { id: string; name: string | null }[], ids: string[]) {
  return ids.map((id) => items.find((item) => item.id === id)?.name ?? "Unavailable selection").join(", ");
}
function SavedFilters({ detail }: { detail: Detail }) {
  const { filters } = detail.view;
  const groups = [
    filters.statuses.length
      ? `Status: ${filters.statuses.map((status) => taskStatusOptions[status].label).join(", ")}`
      : null,
    filters.priorities.length ? `Priority: ${filters.priorities.join(", ")}` : null,
    filters.stateIds.length ? `State: ${selectionNames(detail.selections.states, filters.stateIds)}` : null,
    filters.labelIds.length ? `Label: ${selectionNames(detail.selections.labels, filters.labelIds)}` : null,
    filters.assigneeIds.length ? `Assignee: ${selectionNames(detail.selections.users, filters.assigneeIds)}` : null,
    filters.creatorIds.length ? `Creator: ${selectionNames(detail.selections.users, filters.creatorIds)}` : null,
    filters.startDate ? `Start: ${filters.startDate.from ?? "Any"} → ${filters.startDate.to ?? "Any"}` : null,
    filters.targetDate ? `Target: ${filters.targetDate.from ?? "Any"} → ${filters.targetDate.to ?? "Any"}` : null,
  ].filter((value) => value !== null);
  return (
    <details className="rounded-md border border-subtle-1 p-3">
      <summary className="cursor-pointer text-14 font-medium">
        {groups.length ? `Match ${filters.match} filter groups` : "All active project tasks"}
      </summary>
      <ul className="mt-2 space-y-1 text-14 text-secondary">
        {groups.map((group) => (
          <li key={group}>{group}</li>
        ))}
      </ul>
    </details>
  );
}
function Results({ viewId, project }: { viewId: Id<"savedViews">; project: Project }) {
  const rows = usePaginatedQuery(api.savedViews.results.list, { viewId }, { initialNumItems: 50 });
  const [params] = useSearchParams();
  return (
    <section className="space-y-3">
      <header>
        <h3 className="text-16 font-medium">Matching tasks</h3>
        <p className="text-12 text-secondary">Newest created first</p>
      </header>
      <ul className="divide-y divide-subtle-1">
        {rows.results.map((task) => {
          const next = new URLSearchParams(params);
          next.delete("projectView");
          next.delete("savedView");
          next.delete("savedViewTab");
          next.delete("taskView");
          next.set("task", task._id);
          return (
            <li key={task._id}>
              <Link to={`?${next}`} className="grid gap-1 py-3 text-14 sm:grid-cols-[6rem_minmax(0,1fr)_8rem]">
                <span className="text-12 text-secondary">
                  {project.identifier}-{task.sequence}
                </span>
                <span className="font-medium break-words">{task.title}</span>
                <span className="text-secondary">{taskStatusOptions[task.status].label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
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
function Favorite({ detail }: { detail: Pick<Detail, "view" | "canFavorite" | "isFavorite"> }) {
  const save = useMutation(api.savedViews.favorites.set);
  const [pending, setPending] = useState(false),
    [error, setError] = useState("");
  if (!detail.canFavorite) return null;
  return (
    <div className="space-y-1">
      <Button
        variant="secondary"
        aria-pressed={detail.isFavorite}
        loading={pending}
        onClick={async () => {
          setPending(true);
          setError("");
          try {
            await save({ viewId: detail.view._id, favorite: !detail.isFavorite });
          } catch (failure) {
            setError(mutationMessage(failure));
          } finally {
            setPending(false);
          }
        }}
      >
        {detail.isFavorite ? "Unfavorite" : "Favorite"}
      </Button>
      {error && (
        <p role="alert" className="text-12 text-danger-primary">
          {error}
        </p>
      )}
    </div>
  );
}
function ViewLifecycle({ detail, onDone }: { detail: Detail; onDone: (deleted: boolean) => void }) {
  const save = useMutation(api.savedViews.index.lifecycle);
  const [snapshot, setSnapshot] = useState<Detail | null>(null),
    [pending, setPending] = useState(false),
    [error, setError] = useState("");
  if (!detail.canRemove && !detail.canRestore) return null;
  return (
    <section className="space-y-3 border-t border-subtle-1 pt-4">
      {snapshot ? (
        <>
          <p className="text-14">
            {snapshot.canRestore
              ? "Restore this saved view definition?"
              : "Move this view to Trash? Its tasks stay unchanged."}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              loading={pending}
              onClick={async () => {
                setPending(true);
                setError("");
                try {
                  const deleted = !snapshot.canRestore;
                  await save({ viewId: snapshot.view._id, expectedUpdatedAt: snapshot.view.updatedAt, deleted });
                  onDone(deleted);
                } catch (failure) {
                  setError(mutationMessage(failure));
                } finally {
                  setPending(false);
                }
              }}
            >
              {snapshot.canRestore ? "Confirm restore view" : "Confirm remove view"}
            </Button>
            <Button variant="secondary" disabled={pending} onClick={() => setSnapshot(null)}>
              Cancel
            </Button>
          </div>
        </>
      ) : (
        <Button
          variant="secondary"
          onClick={() => {
            setSnapshot(detail);
            setError("");
          }}
        >
          {detail.canRestore ? "Restore view" : "Remove view"}
        </Button>
      )}
      {error && (
        <p role="alert" className="text-14 text-danger-primary">
          {error}
        </p>
      )}
    </section>
  );
}
class ViewBoundary extends Component<{ children: ReactNode; onBack: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <section className="space-y-3">
        <h2 className="text-20 font-semibold">This saved view is unavailable</h2>
        <Button variant="secondary" onClick={this.props.onBack}>
          Back to saved views
        </Button>
      </section>
    ) : (
      this.props.children
    );
  }
}
