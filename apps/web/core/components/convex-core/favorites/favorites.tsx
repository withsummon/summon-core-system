import { Component, useState } from "react";
import type { ReactNode } from "react";
import { Link } from "react-router";
import { usePaginatedQuery, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import type { Id } from "@summon/convex/data-model";
import { api } from "@summon/convex/api";
import { ChevronDown, ChevronRight, Folder, Star, MoreHorizontal } from "lucide-react";
import { SidebarNavItem } from "@/components/sidebar/sidebar-navigation";
import { Button } from "@plane/propel/button";
import { FavoriteEditor, CreateFolder } from "./editor";
import { favoriteRoute } from "./route";
type Workspace = FunctionReturnType<typeof api.workspaces.index.list>[number];
type Row = FunctionReturnType<typeof api.favorites.index.list>["page"][number];
export function Favorites({ workspace, onNavigate }: { workspace: Workspace; onNavigate: () => void }) {
  const [editing, setEditing] = useState<{ row: Row; locationName: string } | null>(null);
  const access = useQuery(api.favorites.index.access, { workspaceId: workspace._id });
  if (!access?.canManage) return null;
  return (
    <section className="space-y-2 overflow-x-auto" aria-label="Favorites">
      <h2 className="px-2 text-12 font-semibold text-secondary">Favorites</h2>
      <FavoriteBoundary>
        <FolderContents
          workspace={workspace}
          parentId={null}
          locationName="Favorites root"
          depth={0}
          maxDepth={access.maxDepth}
          onNavigate={onNavigate}
          onManage={(row, locationName) => setEditing({ row, locationName })}
        />
      </FavoriteBoundary>
      {editing && (
        <FavoriteEditor row={editing.row} locationName={editing.locationName} onClose={() => setEditing(null)} />
      )}
    </section>
  );
}
function FolderContents({
  workspace,
  parentId,
  locationName,
  depth,
  maxDepth,
  onNavigate,
  onManage,
}: {
  onManage: (row: Row, locationName: string) => void;
  workspace: Workspace;
  parentId: Id<"favorites"> | null;
  locationName: string;
  depth: number;
  maxDepth: number;
  onNavigate: () => void;
}) {
  const [deleted, setDeleted] = useState(false),
    [creating, setCreating] = useState(false);
  const rows = usePaginatedQuery(
    api.favorites.index.list,
    { workspaceId: workspace._id, parentId, deleted },
    { initialNumItems: 30 }
  );
  return (
    <div className="min-w-0 space-y-1">
      <div className="flex flex-wrap gap-x-3 gap-y-1 px-2 text-12">
        <button
          type="button"
          className="py-1 text-accent-primary disabled:text-tertiary"
          disabled={depth >= maxDepth}
          onClick={() => setCreating(true)}
        >
          Add folder
        </button>
        <button
          type="button"
          className="py-1 text-secondary"
          aria-pressed={deleted}
          onClick={() => setDeleted(!deleted)}
        >
          {deleted ? "Show favorites" : "Removed here"}
        </button>
      </div>
      {deleted && <p className="px-2 text-12 text-secondary">Removed from {locationName}</p>}
      <ul className="min-w-0 space-y-0.5">
        {rows.results.map((row) => (
          <FavoriteRow
            key={row._id}
            row={row}
            onManage={() => onManage(row, locationName)}
            onManageNested={onManage}
            workspace={workspace}
            depth={depth}
            maxDepth={maxDepth}
            onNavigate={onNavigate}
          />
        ))}
      </ul>
      {rows.status === "LoadingFirstPage" && (
        <p role="status" className="px-2 text-12 text-secondary">
          Loading favorites…
        </p>
      )}
      {rows.status === "Exhausted" && !rows.results.length && (
        <p className="px-2 py-2 text-12 text-secondary">
          {deleted ? "No removed favorites here." : "No favorites here yet."}
        </p>
      )}
      {rows.status === "CanLoadMore" && (
        <Button variant="secondary" onClick={() => rows.loadMore(30)}>
          Load more favorites
        </Button>
      )}
      {creating && <CreateFolder workspaceId={workspace._id} parentId={parentId} onClose={() => setCreating(false)} />}
    </div>
  );
}
function FavoriteRow({
  row,
  workspace,
  depth,
  maxDepth,
  onNavigate,
  onManage,
  onManageNested,
}: {
  onManageNested: (row: Row, locationName: string) => void;
  row: Row;
  onManage: () => void;
  workspace: Workspace;
  depth: number;
  maxDepth: number;
  onNavigate: () => void;
}) {
  const [open, setOpen] = useState(false);
  const name = row.name || row.entity.name || "Untitled folder";
  const folder = row.target.type === "folder",
    href = favoriteRoute(workspace.slug, row);

  return (
    <li className="min-w-40">
      <SidebarNavItem className="gap-1">
        {folder ? (
          <button
            type="button"
            className="flex min-w-0 flex-1 items-center gap-1 py-1 text-left text-13 font-medium"
            aria-expanded={open}
            disabled={row.isRemoved}
            onClick={() => setOpen(!open)}
            title={name}
          >
            {open ? <ChevronDown className="size-3 shrink-0" /> : <ChevronRight className="size-3 shrink-0" />}
            <Folder className="size-4 shrink-0" aria-hidden />
            <span className="truncate">{name}</span>
          </button>
        ) : href ? (
          <Link
            to={href}
            title={name}
            onClick={onNavigate}
            className="flex min-w-0 flex-1 items-center gap-1.5 py-1 text-13 font-medium"
          >
            <Star className="size-4 shrink-0" aria-hidden />
            <span className="truncate">{name}</span>
          </Link>
        ) : (
          <span className="min-w-0 flex-1 truncate text-13">{name}</span>
        )}
        {row.canManage && (
          <button
            type="button"
            className="shrink-0 rounded p-1 hover:bg-layer-2"
            aria-label={`Manage ${name}`}
            onClick={onManage}
          >
            <MoreHorizontal className="size-4" aria-hidden />
          </button>
        )}
      </SidebarNavItem>
      {folder && open && !row.isRemoved && (
        <div className="ml-1 min-w-0 border-l border-subtle-1 pl-1">
          <FavoriteBoundary>
            <FolderContents
              workspace={workspace}
              parentId={row._id}
              locationName={name}
              depth={depth + 1}
              maxDepth={maxDepth}
              onNavigate={onNavigate}
              onManage={onManageNested}
            />
          </FavoriteBoundary>
        </div>
      )}
    </li>
  );
}
class FavoriteBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <p role="alert" className="px-2 text-12 text-secondary">
        These favorites are unavailable. Their folder or your access may have changed.
      </p>
    ) : (
      this.props.children
    );
  }
}
