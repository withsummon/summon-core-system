import { useState } from "react";
import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
import { api } from "@summon/convex/api";
import type { FunctionReturnType } from "convex/server";
import type { Doc, Id } from "@summon/convex/data-model";
import { Button } from "@plane/propel/button";
import { Input } from "@plane/propel/input";
import { Contacts } from "./contacts";
import { ClientForm } from "./client-form";
import { cardClass, DeleteRecord } from "./forms";

export function Clients({ workspace }: { workspace: FunctionReturnType<typeof api.workspaces.index.list>[number] }) {
  const { results, status, loadMore } = usePaginatedQuery(
    api.commercial.clients.list,
    { workspaceId: workspace._id },
    { initialNumItems: 50 }
  );
  const [selected, setSelected] = useState<Id<"clients"> | null>(null);
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState("");
  const client = useQuery(
    api.commercial.clients.get,
    selected ? { workspaceId: workspace._id, clientId: selected } : "skip"
  );
  const canWrite = workspace.membershipRole !== "guest";
  if (selected && !client) return <p role="status">Loading client…</p>;
  if (client)
    return <ClientDetail key={client._id} client={client} canWrite={canWrite} onBack={() => setSelected(null)} />;
  return (
    <section className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-secondary">{workspace.name}</p>
          <h1 className="text-2xl font-semibold">Clients</h1>
        </div>
        {canWrite && <Button onClick={() => setCreating(true)}>Add client</Button>}
      </header>
      {canWrite && creating && (
        <ClientForm
          workspaceId={workspace._id}
          client={null}
          onDone={(id) => {
            setCreating(false);
            setSelected(id);
          }}
          onCancel={() => setCreating(false)}
        />
      )}
      <Input
        aria-label="Filter loaded clients"
        placeholder="Filter loaded clients"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
      />
      {status === "LoadingFirstPage" && <p role="status">Loading clients…</p>}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {results
          .filter((item) =>
            [item.name, item.companyName, item.industry].some((value) =>
              value.toLowerCase().includes(search.toLowerCase())
            )
          )
          .map((item) => (
            <button
              key={item._id}
              className={`${cardClass} hover:border-accent-primary min-w-0 text-left`}
              onClick={() => setSelected(item._id)}
            >
              <h2 className="truncate font-semibold">{item.name}</h2>
              <p className="text-sm mt-1 truncate text-secondary">
                {item.companyName || item.industry || "Company details not set"}
              </p>
              <p className="text-sm mt-4 line-clamp-2 min-h-10 text-secondary">
                {item.notes || "No relationship notes yet."}
              </p>
              <div className="text-xs mt-4 flex justify-between border-t border-subtle-1 pt-3">
                <span className="capitalize">{item.status}</span>
                <span className="text-accent-primary">View client →</span>
              </div>
            </button>
          ))}
      </div>
      {status === "Exhausted" && !results.length && <p className="text-sm text-secondary">No clients yet.</p>}
      {status === "CanLoadMore" && (
        <Button variant="secondary" onClick={() => loadMore(50)}>
          Load more clients
        </Button>
      )}
    </section>
  );
}
function ClientDetail({ client, canWrite, onBack }: { client: Doc<"clients">; canWrite: boolean; onBack: () => void }) {
  const [editing, setEditing] = useState(false);
  const remove = useMutation(api.commercial.clients.remove);
  return (
    <article className="space-y-5">
      <Button variant="secondary" onClick={onBack}>
        Back to clients
      </Button>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm text-secondary">{client.companyName}</p>
          <h1 className="text-2xl font-semibold">{client.name}</h1>
          <p className="text-sm mt-1 text-secondary capitalize">
            {client.status} · {client.industry || "Industry not set"}
          </p>
        </div>
        {canWrite && (
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => setEditing(true)}>
              Edit client
            </Button>
            <DeleteRecord
              label="client"
              onDelete={async () => {
                await remove({ workspaceId: client.workspaceId, clientId: client._id });
                onBack();
              }}
            />
          </div>
        )}
      </header>
      {canWrite && editing && (
        <ClientForm
          workspaceId={client.workspaceId}
          client={client}
          onDone={() => setEditing(false)}
          onCancel={() => setEditing(false)}
        />
      )}
      <dl className={`${cardClass} grid gap-4 sm:grid-cols-2 lg:grid-cols-3`}>
        {[
          { label: "Email", value: client.email },
          { label: "Phone", value: client.phone },
          { label: "Website", value: client.website },
          { label: "Head office", value: client.headOffice },
          { label: "Relationship started", value: client.relationshipStartedAt },
        ].map((item) => (
          <div key={item.label}>
            <dt className="text-xs text-secondary">{item.label}</dt>
            <dd className="text-sm mt-1 break-words">{item.value || "Not set"}</dd>
          </div>
        ))}
      </dl>
      <section className={cardClass}>
        <h2 className="font-semibold">Relationship notes</h2>
        <p className="text-sm mt-3 break-words whitespace-pre-wrap text-secondary">
          {client.notes || "No relationship notes yet."}
        </p>
      </section>
      <Contacts client={client} canWrite={canWrite} />
    </article>
  );
}
