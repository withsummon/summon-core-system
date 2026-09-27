import { RecordVisit } from "../navigation/record-visit";
import { FavoriteToggle } from "../favorites/toggle";
import { Component, useState } from "react";
import type { ReactNode } from "react";
import { useSearchParams } from "react-router";
import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
import { api } from "@summon/convex/api";
import type { FunctionReturnType } from "convex/server";
import type { Doc } from "@summon/convex/data-model";
import { Button } from "@plane/propel/button";
import { Input } from "@plane/propel/input";
import { cardClass, DeleteRecord, mutationMessage } from "../commercial/forms";
import { MetadataForm } from "./metadata-form";
import { DocumentEditor } from "./editor";
import { DocumentTrash } from "./trash";

export function Documents({ workspace }: { workspace: FunctionReturnType<typeof api.workspaces.index.list>[number] }) {
  const { results, status, loadMore } = usePaginatedQuery(
    api.documents.index.list,
    { workspaceId: workspace._id },
    { initialNumItems: 50 }
  );
  const [params, setParams] = useSearchParams();
  const selected = params.get("document");
  const setSelected = (id: string | null) =>
    setParams((current) => {
      const next = new URLSearchParams(current);
      if (id) next.set("document", id);
      else next.delete("document");
      return next;
    });
  const [creating, setCreating] = useState(false);
  const [trash, setTrash] = useState(false);
  const [search, setSearch] = useState("");
  if (selected)
    return (
      <DocumentAccessBoundary key={selected} onBack={() => setSelected(null)}>
        <DocumentDetail
          documentId={selected}
          workspaceRole={workspace.membershipRole}
          onBack={() => setSelected(null)}
        />
      </DocumentAccessBoundary>
    );
  return (
    <section className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-secondary">{workspace.name}</p>
          <h1 className="text-2xl font-semibold">Documents & knowledge</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            aria-pressed={trash}
            onClick={() => {
              setTrash(!trash);
              setCreating(false);
            }}
          >
            {trash ? "Back to documents" : "Trash"}
          </Button>
          {!trash && workspace.membershipRole !== "guest" && (
            <Button onClick={() => setCreating(true)}>New document</Button>
          )}
        </div>
      </header>
      {trash ? (
        <DocumentTrash workspaceId={workspace._id} canRestore={workspace.membershipRole !== "guest"} />
      ) : (
        <>
          {creating && workspace.membershipRole !== "guest" && (
            <MetadataForm
              workspaceId={workspace._id}
              document={null}
              canManage
              onDone={(id) => {
                setCreating(false);
                setSelected(id);
              }}
              onCancel={() => setCreating(false)}
            />
          )}
          <Input
            aria-label="Filter loaded documents"
            placeholder="Filter loaded documents"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          {status === "LoadingFirstPage" && <p role="status">Loading documents…</p>}
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {results
              .filter((document) => document.name.toLowerCase().includes(search.toLowerCase()))
              .map((document) => (
                <button
                  className={`${cardClass} hover:border-accent-primary min-w-0 text-left`}
                  key={document._id}
                  onClick={() => setSelected(document._id)}
                >
                  <p className="text-xs text-secondary capitalize">{document.category}</p>
                  <h2 className="mt-2 font-semibold break-words">{document.name || "Untitled"}</h2>
                  <p className="text-xs mt-3 text-secondary">
                    {document.access === "private" ? "Private" : document.isGlobal ? "Workspace" : "Project document"}
                  </p>
                  {document.isLocked && <p className="text-xs mt-2 text-secondary">Locked</p>}
                  {document.archived && <p className="text-xs mt-2 text-secondary">Archived</p>}
                </button>
              ))}
          </div>
          {status === "Exhausted" && !results.length && (
            <p className="text-sm text-secondary">No documents are visible to you yet.</p>
          )}
          {status === "CanLoadMore" && (
            <Button variant="secondary" onClick={() => loadMore(50)}>
              Load more documents
            </Button>
          )}
        </>
      )}
    </section>
  );
}
function DocumentDetail({
  documentId,
  workspaceRole,
  onBack,
}: {
  documentId: string;
  workspaceRole: Doc<"workspaceMembers">["role"];
  onBack: () => void;
}) {
  const context = useQuery(api.documents.index.collaborationContext, { documentId });
  const document = useQuery(api.documents.index.get, context ? { documentId: context.documentId } : "skip");
  const [settings, setSettings] = useState(false);
  if (!document || !context) return <p role="status">Opening document…</p>;
  const owner = document.ownedBy === context.userId && workspaceRole !== "guest";
  return (
    <article className="space-y-5">
      <RecordVisit workspaceId={document.workspaceId} target={{ type: "page", id: document._id }} />
      <header className="flex flex-wrap items-center justify-between gap-3">
        <Button variant="secondary" onClick={onBack}>
          Back to documents
        </Button>
        <div className="flex flex-wrap gap-2">
          <FavoriteToggle workspaceId={document.workspaceId} target={{ type: "page", id: document._id }} />
          {context.canWrite && (
            <Button variant="secondary" onClick={() => setSettings((value) => !value)}>
              Document settings
            </Button>
          )}
          {owner && <Lifecycle document={document} onDeleted={onBack} />}
        </div>
      </header>
      {settings && context.canWrite && (
        <MetadataForm
          workspaceId={document.workspaceId}
          document={document}
          canManage={owner}
          onDone={() => setSettings(false)}
          onCancel={() => setSettings(false)}
        />
      )}
      <DocumentEditor context={context} />
    </article>
  );
}
function Lifecycle({ document, onDeleted }: { document: Doc<"documents">; onDeleted: () => void }) {
  const lifecycle = useMutation(api.documents.index.setLifecycle);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  async function toggle(property: "isLocked" | "archived") {
    setPending(true);
    setError("");
    try {
      await lifecycle({
        documentId: document._id,
        expectedUpdatedAt: document.updatedAt,
        isLocked: document.isLocked,
        archived: document.archived,
        deleted: false,
        [property]: !document[property],
      });
    } catch (failure) {
      setError(mutationMessage(failure));
    } finally {
      setPending(false);
    }
  }
  return (
    <details className="relative">
      <summary className="text-sm cursor-pointer rounded-md border border-subtle-1 px-3 py-2">Manage document</summary>
      <div className="shadow-lg absolute right-0 z-20 mt-2 w-64 space-y-3 rounded-xl border border-subtle-1 bg-surface-1 p-3">
        <Button variant="secondary" loading={pending} onClick={() => void toggle("isLocked")}>
          {document.isLocked ? "Unlock document" : "Lock document"}
        </Button>
        <Button variant="secondary" disabled={pending} onClick={() => void toggle("archived")}>
          {document.archived ? "Unarchive document" : "Archive document"}
        </Button>
        <DeleteRecord
          label="document"
          onDelete={async () => {
            await lifecycle({
              documentId: document._id,
              expectedUpdatedAt: document.updatedAt,
              isLocked: document.isLocked,
              archived: document.archived,
              deleted: true,
            });
            onDeleted();
          }}
        />
        {error && (
          <p role="alert" className="text-sm text-danger-primary">
            {error}
          </p>
        )}
      </div>
    </details>
  );
}

class DocumentAccessBoundary extends Component<{ children: ReactNode; onBack: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <section className="space-y-4">
        <h1 className="text-xl font-semibold">This document is unavailable</h1>
        <p role="alert" className="text-sm text-secondary">
          It may have been removed, or your access may have changed.
        </p>
        <Button variant="secondary" onClick={this.props.onBack}>
          Back to documents
        </Button>
      </section>
    );
  }
}
