import { Component, useState } from "react";
import { useSearchParams } from "react-router";
import type { ReactNode } from "react";
import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import type { Id } from "@summon/convex/data-model";
import { api } from "@summon/convex/api";
import { Button } from "@plane/propel/button";
import { Input } from "@plane/propel/input";
import { SummonField } from "@/components/summon/forms";
import { STICKY_COLORS_LIST } from "@/components/editor/sticky-editor/color-palette";
import { TaskRichEditor } from "../tasks/rich-editor";
import { mutationMessage, field } from "../commercial/forms";
import { StickyForm } from "./form";
import { adjacentStickyOrder } from "./order";
type Workspace = Pick<FunctionReturnType<typeof api.navigation.address.resolveWorkspace>["workspace"], "_id" | "name">;
type Sticky = FunctionReturnType<typeof api.stickies.index.get>;
export function Stickies({ workspace }: { workspace: Workspace }) {
  const [params, setParams] = useSearchParams();
  const selected = params.get("sticky");
  const setSelected = (id: Id<"stickies"> | null) => {
    const next = new URLSearchParams(params);
    if (id) next.set("sticky", id);
    else next.delete("sticky");
    setParams(next);
  };
  const [creating, setCreating] = useState(false),
    [deleted, setDeleted] = useState(false),
    [query, setQuery] = useState(""),
    [layout, setLayout] = useState<"grid" | "list">("grid");
  const notes = usePaginatedQuery(
    api.stickies.index.list,
    selected || creating ? "skip" : { workspaceId: workspace._id, deleted, query },
    { initialNumItems: 30 }
  );
  const select = (id: Id<"stickies">) => {
    setCreating(false);
    setSelected(id);
  };
  if (creating)
    return (
      <StickyForm workspaceId={workspace._id} initial={null} onDone={select} onCancel={() => setCreating(false)} />
    );
  if (selected)
    return (
      <StickyBoundary key={selected} onBack={() => setSelected(null)}>
        <StickyDetail
          workspaceId={workspace._id}
          stickyId={selected}
          onBack={() => setSelected(null)}
          onLifecycle={(trash) => {
            setSelected(null);
            setDeleted(trash);
            setQuery("");
          }}
        />
      </StickyBoundary>
    );
  return (
    <section className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-12 text-secondary">{workspace.name} · Only you</p>
          <h1 className="text-28 font-semibold">Stickies</h1>
        </div>
        <Button onClick={() => setCreating(true)}>Create sticky</Button>
      </header>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav aria-label="Sticky views" className="flex gap-2">
          <Button variant={!deleted ? "primary" : "secondary"} onClick={() => setDeleted(false)}>
            My notes
          </Button>
          <Button variant={deleted ? "primary" : "secondary"} onClick={() => setDeleted(true)}>
            Trash
          </Button>
        </nav>
        <div role="group" aria-label="Sticky layout" className="flex gap-2">
          <Button
            variant={layout === "grid" ? "primary" : "secondary"}
            aria-pressed={layout === "grid"}
            onClick={() => setLayout("grid")}
          >
            Grid
          </Button>
          <Button
            variant={layout === "list" ? "primary" : "secondary"}
            aria-pressed={layout === "list"}
            onClick={() => setLayout("list")}
          >
            List
          </Button>
        </div>
      </div>
      <form
        key={query}
        className="flex flex-wrap items-end gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          setQuery(field(new FormData(event.currentTarget), "query"));
        }}
      >
        <SummonField label="Search note text">
          <Input name="query" type="search" defaultValue={query} maxLength={1000} />
        </SummonField>
        <Button type="submit" variant="secondary">
          Search
        </Button>
        {query && (
          <Button variant="secondary" onClick={() => setQuery("")}>
            Clear search
          </Button>
        )}
      </form>
      <ul className={layout === "grid" ? "grid gap-4 sm:grid-cols-2 xl:grid-cols-3" : "space-y-3"}>
        {notes.results.map((note, index) => (
          <li
            key={note._id}
            className="min-w-0 rounded-xl border border-subtle-1 p-4"
            style={{
              backgroundColor: STICKY_COLORS_LIST.find((color) => color.key === note.backgroundColor)?.backgroundColor,
            }}
          >
            <button className="block w-full space-y-2 text-left" onClick={() => select(note._id)}>
              <h2 className="text-16 font-semibold break-words">{note.name || "Untitled sticky"}</h2>
              <p className="line-clamp-5 min-h-10 text-14 break-words whitespace-pre-wrap">
                {note.description || "Empty note"}
              </p>
              <p className="text-12 text-secondary">
                {deleted ? "Removed" : "Updated"}{" "}
                {new Date(deleted ? (note.deletedAt ?? note.updatedAt) : note.updatedAt).toLocaleString()}
              </p>
            </button>
            {!deleted && !query && (
              <ReorderSticky
                note={note}
                up={adjacentStickyOrder(notes.results, index, "up", notes.status !== "Exhausted")}
                down={adjacentStickyOrder(notes.results, index, "down", notes.status !== "Exhausted")}
              />
            )}
          </li>
        ))}
      </ul>
      {notes.status === "LoadingFirstPage" && <p role="status">Loading stickies…</p>}
      {notes.status === "Exhausted" && !notes.results.length && (
        <p className="py-8 text-center text-14 text-secondary">
          {query
            ? "No notes match this text."
            : deleted
              ? "Your sticky Trash is empty."
              : "Create your first private note."}
        </p>
      )}
      {notes.status === "CanLoadMore" && (
        <Button variant="secondary" onClick={() => notes.loadMore(30)}>
          Load more stickies
        </Button>
      )}
    </section>
  );
}
function ReorderSticky({ note, up, down }: { note: Sticky; up: number | null; down: number | null }) {
  const reorder = useMutation(api.stickies.index.reorder);
  const [pending, setPending] = useState(false),
    [error, setError] = useState("");
  const move = async (sortOrder: number) => {
    setPending(true);
    setError("");
    try {
      await reorder({
        workspaceId: note.workspaceId,
        stickyId: note._id,
        expectedUpdatedAt: note.updatedAt,
        sortOrder,
      });
    } catch (failure) {
      setError(mutationMessage(failure));
    } finally {
      setPending(false);
    }
  };
  return (
    <div className="mt-3 space-y-2">
      <div className="flex flex-wrap gap-2">
        <Button
          variant="secondary"
          disabled={pending || up === null}
          aria-label={`Move ${note.name || "untitled sticky"} earlier`}
          onClick={() => {
            if (up !== null) void move(up);
          }}
        >
          Move earlier
        </Button>
        <Button
          variant="secondary"
          disabled={pending || down === null}
          aria-label={`Move ${note.name || "untitled sticky"} later`}
          onClick={() => {
            if (down !== null) void move(down);
          }}
        >
          Move later
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-12 text-danger-primary">
          {error}
        </p>
      )}
    </div>
  );
}
function StickyDetail({
  workspaceId,
  stickyId,
  onBack,
  onLifecycle,
}: {
  workspaceId: Id<"workspaces">;
  stickyId: string;
  onBack: () => void;
  onLifecycle: (deleted: boolean) => void;
}) {
  const note = useQuery(api.stickies.index.resolve, { workspaceId, stickyId });
  const [editing, setEditing] = useState(false);
  if (!note) return <p role="status">Opening sticky…</p>;
  if (editing)
    return (
      <StickyForm
        workspaceId={workspaceId}
        initial={note}
        onDone={() => setEditing(false)}
        onCancel={() => setEditing(false)}
      />
    );
  return (
    <article className="max-w-4xl space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <Button variant="secondary" onClick={onBack}>
          Back to stickies
        </Button>
        {note.deletedAt === null && <Button onClick={() => setEditing(true)}>Edit sticky</Button>}
      </header>
      <div
        className="space-y-4 rounded-xl border border-subtle-1 p-4"
        style={{
          backgroundColor: STICKY_COLORS_LIST.find((color) => color.key === note.backgroundColor)?.backgroundColor,
        }}
      >
        <p className="text-12 text-secondary">Only you{note.deletedAt !== null ? " · In Trash" : ""}</p>
        <h2 className="text-24 font-semibold break-words">{note.name || "Untitled sticky"}</h2>
        {note.description.trim() ? (
          <TaskRichEditor
            key={note.updatedAt}
            id={`sticky-${note._id}`}
            label="Sticky content"
            placeholder=""
            html={note.html}
            editable={false}
          />
        ) : (
          <p className="text-14 text-secondary">Empty note</p>
        )}
      </div>
      <StickyLifecycle note={note} onDone={onLifecycle} />
    </article>
  );
}
function StickyLifecycle({ note, onDone }: { note: Sticky; onDone: (deleted: boolean) => void }) {
  const remove = useMutation(api.stickies.index.remove),
    restore = useMutation(api.stickies.index.restore);
  const [snapshot, setSnapshot] = useState<Sticky | null>(null),
    [pending, setPending] = useState(false),
    [error, setError] = useState("");
  return (
    <section className="space-y-3 border-t border-subtle-1 pt-4">
      {snapshot ? (
        <>
          <p className="text-14">
            {snapshot.deletedAt === null
              ? "Move this private sticky to Trash? You can restore it later."
              : "Restore this sticky with its saved content, appearance, and position?"}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              loading={pending}
              onClick={async () => {
                setPending(true);
                setError("");
                try {
                  const args = {
                    workspaceId: snapshot.workspaceId,
                    stickyId: snapshot._id,
                    expectedUpdatedAt: snapshot.updatedAt,
                  };
                  if (snapshot.deletedAt === null) await remove(args);
                  else await restore(args);
                  onDone(snapshot.deletedAt === null);
                } catch (failure) {
                  setError(mutationMessage(failure));
                } finally {
                  setPending(false);
                }
              }}
            >
              {snapshot.deletedAt === null ? "Confirm move to Trash" : "Confirm restore sticky"}
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
            setError("");
            setSnapshot(note);
          }}
        >
          {note.deletedAt === null ? "Move sticky to Trash" : "Restore sticky"}
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
class StickyBoundary extends Component<{ children: ReactNode; onBack: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <section className="space-y-3">
        <h2 className="text-20 font-semibold">This sticky is unavailable</h2>
        <Button variant="secondary" onClick={this.props.onBack}>
          Back to stickies
        </Button>
      </section>
    ) : (
      this.props.children
    );
  }
}
