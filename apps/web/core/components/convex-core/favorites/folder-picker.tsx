import { Component, useState } from "react";
import { usePaginatedQuery } from "convex/react";
import type { ReactNode } from "react";
import type { Id } from "@summon/convex/data-model";
import { api } from "@summon/convex/api";
import { Button } from "@plane/propel/button";
import { Folder } from "lucide-react";
type Location = { id: Id<"favorites">; name: string };
function FolderDirectory({
  workspaceId,
  excludeId,
  onSelect,
}: {
  workspaceId: Id<"workspaces">;
  excludeId?: Id<"favorites">;
  onSelect: (folder: Location | null) => void;
}) {
  const [path, setPath] = useState<Location[]>([]);
  const current = path.at(-1);
  const folders = usePaginatedQuery(
    api.favorites.index.list,
    { workspaceId, parentId: current?.id ?? null, deleted: false },
    { initialNumItems: 30 }
  );
  return (
    <section className="space-y-3 rounded-md border border-subtle-1 p-3" aria-label="Choose favorite folder">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="secondary" onClick={() => setPath([])}>
          Favorites root
        </Button>
        {path.map((folder, index) => (
          <Button key={folder.id} variant="secondary" onClick={() => setPath(path.slice(0, index + 1))}>
            {folder.name}
          </Button>
        ))}
      </div>
      <Button variant="secondary" onClick={() => onSelect(current ?? null)}>
        Use {current?.name ?? "Favorites root"}
      </Button>
      <ul className="space-y-1">
        {folders.results
          .filter((row) => row.target.type === "folder" && row._id !== excludeId)
          .map((row) => (
            <li key={row._id}>
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-14 hover:bg-layer-2"
                onClick={() => setPath([...path, { id: row._id, name: row.name || "Untitled folder" }])}
              >
                <Folder className="size-4 shrink-0" aria-hidden />
                <span className="break-words">{row.name || "Untitled folder"}</span>
              </button>
            </li>
          ))}
      </ul>
      {folders.status === "LoadingFirstPage" && <p role="status">Loading folders…</p>}
      {folders.status === "CanLoadMore" && (
        <Button variant="secondary" onClick={() => folders.loadMore(30)}>
          Load more folders
        </Button>
      )}
    </section>
  );
}

export function FolderPicker(props: Parameters<typeof FolderDirectory>[0]) {
  const [attempt, setAttempt] = useState(0);
  return (
    <PickerBoundary key={attempt} onReset={() => setAttempt(attempt + 1)}>
      <FolderDirectory {...props} />
    </PickerBoundary>
  );
}
class PickerBoundary extends Component<{ children: ReactNode; onReset: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <div className="space-y-2">
        <p role="alert" className="text-14">
          This folder is unavailable. Your changes are kept.
        </p>
        <Button variant="secondary" onClick={this.props.onReset}>
          Browse from favorites root
        </Button>
      </div>
    ) : (
      this.props.children
    );
  }
}
