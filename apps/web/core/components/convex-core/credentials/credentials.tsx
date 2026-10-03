import { Component, useCallback, useState } from "react";
import type { ReactNode } from "react";
import { useSearchParams } from "react-router";
import { usePaginatedQuery, useQuery } from "convex/react";
import type { FunctionArgs, FunctionReturnType } from "convex/server";
import { api } from "@summon/convex/api";
import type { Id } from "@summon/convex/data-model";
import { Button } from "@plane/propel/button";
import { CredentialForm } from "./credential-form";
import { SensitiveOperation } from "./sensitive-operation";
import { CredentialAccess, CredentialAudit } from "./access";
import { CredentialInvocations } from "./invocations";
export function Credentials({
  workspace,
}: {
  workspace: FunctionReturnType<typeof api.workspaces.index.list>[number];
}) {
  const list = usePaginatedQuery(api.mcp.credentials.list, { workspaceId: workspace._id }, { initialNumItems: 30 });
  const [params, setParams] = useSearchParams();
  const selected = params.get("credential");
  const [creating, setCreating] = useState(false);
  const canWrite = workspace.membershipRole !== "guest";
  const select = (id: Id<"mcpCredentials"> | null) => {
    setCreating(false);
    setParams((current) => {
      const next = new URLSearchParams(current);
      if (id) next.set("credential", id);
      else next.delete("credential");
      return next;
    });
  };
  return (
    <section className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-12 text-secondary">{workspace.name}</p>
          <h1 className="text-28 font-semibold">Credentials</h1>
        </div>
        {canWrite && <Button onClick={() => setCreating(true)}>New credential</Button>}
      </header>
      <div className="grid gap-5 lg:grid-cols-[15rem_minmax(0,1fr)]">
        <nav
          aria-label="Credentials"
          className="max-h-60 overflow-y-auto border-b border-subtle-1 pb-3 lg:max-h-[65vh] lg:border-r lg:border-b-0 lg:pr-4"
        >
          <div className="space-y-1">
            {list.results.map((item) => (
              <button
                key={item._id}
                aria-current={selected === item._id && !creating ? "page" : undefined}
                className={`block w-full rounded-lg p-3 text-left ${selected === item._id && !creating ? "bg-accent-subtle text-accent-primary" : "hover:bg-layer-1"}`}
                onClick={() => select(item._id)}
              >
                <span className="block text-14 font-medium break-words">{item.name}</span>
                <span className="block text-12 break-words text-secondary">
                  {item.accountIdentifier || item.remoteWorkspaceSlug} · {item.status}
                </span>
              </button>
            ))}
          </div>
          {list.status === "LoadingFirstPage" && <p role="status">Loading credentials…</p>}
          {list.status === "Exhausted" && !list.results.length && (
            <p className="text-14 text-secondary">No credentials shared with you.</p>
          )}
          {list.status === "CanLoadMore" && (
            <Button variant="secondary" onClick={() => list.loadMore(30)}>
              Load more credentials
            </Button>
          )}
        </nav>
        <div className="min-w-0">
          {creating && canWrite ? (
            <CredentialForm
              workspaceId={workspace._id}
              credential={null}
              onDone={select}
              onCancel={() => setCreating(false)}
            />
          ) : selected ? (
            <CredentialBoundary key={selected} onBack={() => select(null)}>
              <CredentialDetail credentialId={selected} workspaceId={workspace._id} onDeleted={() => select(null)} />
            </CredentialBoundary>
          ) : (
            <div className="grid min-h-64 place-content-center text-center">
              <h2 className="text-20 font-medium">Credential vault</h2>
              <p className="mt-2 max-w-sm text-14 text-secondary">
                Select a credential to view its scope, manage access, or review an MCP request.
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
function CredentialDetail({
  credentialId,
  workspaceId,
  onDeleted,
}: {
  credentialId: string;
  workspaceId: Id<"workspaces">;
  onDeleted: () => void;
}) {
  const credential = useQuery(api.mcp.credentials.resolve, { credentialId });
  const [editing, setEditing] = useState(false);
  const [tab, setTab] = useState("overview");
  const [operation, setOperation] = useState<FunctionArgs<typeof api.mcp.stepUp.verify>["operation"] | null>(null);
  const closeOperation = useCallback(() => setOperation(null), []);
  if (!credential) return <p role="status">Loading credential…</p>;
  if (credential.workspaceId !== workspaceId) return <p role="alert">This credential belongs to another workspace.</p>;
  const manager = credential.canManage;
  const canUse = credential.canUse;
  const canReveal = credential.canReveal;
  if (editing && manager)
    return (
      <CredentialForm
        workspaceId={workspaceId}
        credential={credential}
        onDone={() => setEditing(false)}
        onCancel={() => setEditing(false)}
      />
    );
  return (
    <div className="space-y-5">
      <header className="flex flex-wrap justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-24 font-semibold break-words">{credential.name}</h2>
          <p className="mt-1 text-14 break-words text-secondary">
            {credential.accountIdentifier || "No account identifier"} · {credential.status} · {credential.permission}{" "}
            access
          </p>
        </div>
        {manager && (
          <Button variant="secondary" onClick={() => setEditing(true)}>
            Edit metadata
          </Button>
        )}
      </header>
      <nav aria-label="Credential sections" className="flex flex-wrap gap-2 border-b border-subtle-1 pb-3">
        {["overview", ...(canUse ? ["requests"] : []), ...(manager ? ["access", "activity"] : [])].map((value) => (
          <Button key={value} variant={value === tab ? "primary" : "secondary"} onClick={() => setTab(value)}>
            {value === "requests" ? "MCP requests" : value[0].toUpperCase() + value.slice(1)}
          </Button>
        ))}
      </nav>
      {tab === "access" && manager ? (
        <CredentialAccess credential={credential} />
      ) : tab === "activity" && manager ? (
        <CredentialAudit credentialId={credential._id} />
      ) : tab === "requests" && canUse ? (
        <CredentialInvocations credential={credential} />
      ) : (
        <section className="space-y-5">
          <dl className="grid gap-4 rounded-xl border border-subtle-1 p-4 sm:grid-cols-2">
            <div>
              <dt className="text-12 text-secondary">Remote workspace</dt>
              <dd className="text-14 break-all">{credential.remoteWorkspaceSlug}</dd>
            </div>
            <div>
              <dt className="text-12 text-secondary">Remote project</dt>
              <dd className="text-14 break-all">{credential.remoteProjectId ?? "Workspace scope"}</dd>
            </div>
            <div>
              <dt className="text-12 text-secondary">Secret</dt>
              <dd className="font-mono text-14">••••••••••••</dd>
            </div>
          </dl>
          <div className="flex flex-wrap gap-2">
            {canReveal && (
              <Button variant="secondary" onClick={() => setOperation("reveal")}>
                Reveal secret
              </Button>
            )}
            {manager && (
              <>
                <Button variant="secondary" onClick={() => setOperation("rotate")}>
                  Rotate secret
                </Button>
                {credential.status === "active" && (
                  <Button variant="secondary" onClick={() => setOperation("revoke")}>
                    Revoke credential
                  </Button>
                )}
                <Button variant="secondary" onClick={() => setOperation("delete")}>
                  Delete credential
                </Button>
              </>
            )}
          </div>
        </section>
      )}
      {operation && (operation === "reveal" ? canReveal : manager) && (
        <SensitiveOperation
          key={operation}
          credentialId={credential._id}
          operation={operation}
          onClose={closeOperation}
          onDeleted={onDeleted}
        />
      )}
    </div>
  );
}
class CredentialBoundary extends Component<{ children: ReactNode; onBack: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <section className="space-y-3">
        <h2 className="text-20 font-semibold">This credential is unavailable</h2>
        <p role="alert" className="text-14 text-secondary">
          It may have been deleted, or your access may have changed.
        </p>
        <Button variant="secondary" onClick={this.props.onBack}>
          Back to credentials
        </Button>
      </section>
    ) : (
      this.props.children
    );
  }
}
