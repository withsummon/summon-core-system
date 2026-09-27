import { Component, useState, type ReactNode } from "react";
import { useSearchParams } from "react-router";
import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
import { api } from "@summon/convex/api";
import type { FunctionReturnType } from "convex/server";
import type { Id } from "@summon/convex/data-model";
import { Button } from "@plane/propel/button";
import { Input } from "@plane/propel/input";
import { DeleteRecord } from "../commercial/forms";
import { ResourceForm } from "./form";
export function Resources({ workspace }: { workspace: FunctionReturnType<typeof api.workspaces.index.list>[number] }) {
  const [params, setParams] = useSearchParams();
  const selected = params.get("resource");
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState("");
  const list = usePaginatedQuery(api.resources.index.list, { workspaceId: workspace._id }, { initialNumItems: 50 });
  const select = (id: string | null) =>
    setParams((current) => {
      const next = new URLSearchParams(current);
      if (id) next.set("resource", id);
      else next.delete("resource");
      return next;
    });
  if (selected)
    return (
      <ResourceBoundary key={selected} onBack={() => select(null)}>
        <ResourceDetail workspaceId={workspace._id} resourceId={selected} onBack={() => select(null)} />
      </ResourceBoundary>
    );
  if (creating && workspace.membershipRole !== "guest")
    return (
      <ResourceForm
        workspaceId={workspace._id}
        detail={null}
        onDone={(id) => {
          setCreating(false);
          select(id);
        }}
        onCancel={() => setCreating(false)}
      />
    );
  const filtered = list.results.filter((resource) =>
    [resource.title, resource.category, resource.url].some((value) =>
      value.toLowerCase().includes(search.toLowerCase())
    )
  );
  return (
    <section className="max-w-5xl space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-14 text-secondary">{workspace.name}</p>
          <h1 className="mt-1 text-28 font-semibold">Resources</h1>
        </div>
        {workspace.membershipRole !== "guest" && <Button onClick={() => setCreating(true)}>Add resource</Button>}
      </header>
      <Input
        aria-label="Filter loaded resources"
        placeholder="Filter loaded resources by title, category or URL"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
      />
      {list.status === "LoadingFirstPage" ? (
        <p role="status">Loading resources…</p>
      ) : (
        <ul className="divide-y divide-subtle-1 rounded-xl border border-subtle-1">
          {filtered.map((resource) => (
            <li key={resource._id}>
              <button
                onClick={() => select(resource._id)}
                className="flex w-full flex-wrap items-center justify-between gap-3 p-4 text-left hover:bg-layer-2"
              >
                <div className="min-w-0 flex-1">
                  <span className="block font-semibold break-words">{resource.title}</span>
                  <span className="mt-1 block text-13 break-all text-secondary">{resource.url}</span>
                </div>
                {resource.category && <span className="text-12 text-secondary">{resource.category}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
      {list.status !== "LoadingFirstPage" && !filtered.length && (
        <p className="text-14 text-secondary">
          {search ? "No matches in loaded resources." : "No resources loaded yet."}
        </p>
      )}
      {list.status === "CanLoadMore" && (
        <Button variant="secondary" onClick={() => list.loadMore(50)}>
          Load more resources
        </Button>
      )}
      {list.status === "LoadingMore" && <p role="status">Loading more resources…</p>}
    </section>
  );
}
function ResourceDetail({
  workspaceId,
  resourceId,
  onBack,
}: {
  workspaceId: Id<"workspaces">;
  resourceId: string;
  onBack: () => void;
}) {
  const [, setParams] = useSearchParams();
  const detail = useQuery(api.resources.index.detail, { workspaceId, resourceId });
  const remove = useMutation(api.resources.index.remove);
  const [editing, setEditing] = useState(false);
  if (!detail) return <p role="status">Opening resource…</p>;
  const { resource } = detail;
  const credentialId = resource.credentialId;
  if (editing && detail.canWrite)
    return (
      <ResourceForm
        workspaceId={workspaceId}
        detail={detail}
        onDone={() => setEditing(false)}
        onCancel={() => setEditing(false)}
      />
    );
  return (
    <article className="max-w-3xl space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <Button variant="secondary" onClick={onBack}>
          Back to resources
        </Button>
        {detail.canWrite && (
          <Button variant="secondary" onClick={() => setEditing(true)}>
            Edit resource
          </Button>
        )}
      </header>
      <div>
        <p className="text-12 text-secondary">{resource.category || "Resource"}</p>
        <h1 className="mt-2 text-28 font-semibold break-words">{resource.title}</h1>
        <a
          className="mt-3 inline-block text-14 break-all text-accent-primary underline"
          href={resource.url}
          target="_blank"
          rel="noopener noreferrer"
        >
          {resource.url}
        </a>
      </div>
      {resource.description && <p className="text-14 break-words whitespace-pre-wrap">{resource.description}</p>}
      <dl className="grid gap-4 border-y border-subtle-1 py-4 sm:grid-cols-3">
        {[
          ["Project", detail.projectName],
          ["Document", detail.documentName],
          ["Client", detail.clientName],
        ].map(([label, value]) => (
          <div key={label}>
            <dt className="text-12 text-secondary">{label}</dt>
            <dd className="mt-1 text-14 break-words">{value ?? "None"}</dd>
          </div>
        ))}
        {resource.credentialUnavailable && (
          <div>
            <dt className="text-12 text-secondary">Credential</dt>
            <dd className="mt-1 text-14 text-secondary">Not accessible</dd>
          </div>
        )}
        {credentialId && resource.credentialName && (
          <div>
            <dt className="text-12 text-secondary">Credential</dt>
            <dd className="mt-1">
              <button
                className="text-14 break-words text-accent-primary underline"
                onClick={() =>
                  setParams((current) => {
                    const next = new URLSearchParams(current);
                    next.set("module", "credentials");
                    next.set("credential", credentialId);
                    next.delete("resource");
                    return next;
                  })
                }
              >
                {resource.credentialName}
              </button>
            </dd>
          </div>
        )}
      </dl>
      {detail.canWrite && (
        <DeleteRecord
          label="resource"
          onDelete={async () => {
            await remove({ resourceId: resource._id });
            onBack();
          }}
        />
      )}
    </article>
  );
}
class ResourceBoundary extends Component<{ children: ReactNode; onBack: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <section className="space-y-4">
        <h1 className="text-24 font-semibold">This resource is unavailable</h1>
        <p role="alert" className="text-14 text-secondary">
          It may have been removed, or your access may have changed.
        </p>
        <Button variant="secondary" onClick={this.props.onBack}>
          Back to resources
        </Button>
      </section>
    );
  }
}
