import { useState } from "react";
import { useMutation, usePaginatedQuery } from "convex/react";
import type { FunctionArgs, FunctionReturnType } from "convex/server";
import { api } from "@summon/convex/api";
import type { Id } from "@summon/convex/data-model";
import { Button } from "@plane/propel/button";
import { Input } from "@plane/propel/input";
import { SummonField } from "@/components/summon/forms";
import { mutationMessage } from "../commercial/forms";
export function CredentialAccess({ credential }: { credential: FunctionReturnType<typeof api.mcp.credentials.get> }) {
  const grants = usePaginatedQuery(
    api.mcp.credentials.grants,
    { credentialId: credential._id },
    { initialNumItems: 30 }
  );
  const members = usePaginatedQuery(
    api.commercial.directory.members,
    { workspaceId: credential.workspaceId },
    { initialNumItems: 50 }
  );
  const grant = useMutation(api.mcp.credentials.grant);
  const revoke = useMutation(api.mcp.credentials.revokeGrant);
  const [memberId, setMemberId] = useState<Id<"users"> | null>(null);
  const [permission, setPermission] = useState<FunctionArgs<typeof api.mcp.credentials.grant>["permission"]>("use");
  const [expiry, setExpiry] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  return (
    <div className="space-y-5">
      <form
        className="grid gap-3 sm:grid-cols-2"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!memberId) return;
          setPending(true);
          setError("");
          try {
            await grant({
              credentialId: credential._id,
              memberId,
              permission,
              expiresAt: expiry ? new Date(expiry).getTime() : null,
            });
            setMemberId(null);
          } catch (failure) {
            setError(mutationMessage(failure));
          } finally {
            setPending(false);
          }
        }}
      >
        <SummonField label="Member" htmlFor="credential-member">
          <select
            id="credential-member"
            required
            className="rounded-md border border-subtle-1 bg-layer-2 p-2 text-14"
            value={memberId ?? ""}
            onChange={(e) => setMemberId(members.results.find((m) => m.id === e.target.value)?.id ?? null)}
          >
            <option value="">Choose member</option>
            {members.results
              .filter((m) => m.id !== credential.ownerId)
              .map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name ?? m.email ?? m.id}
                </option>
              ))}
          </select>
        </SummonField>
        <SummonField label="Permission" htmlFor="credential-permission">
          <select
            id="credential-permission"
            className="rounded-md border border-subtle-1 bg-layer-2 p-2 text-14"
            value={permission}
            onChange={(e) => {
              if (e.target.value === "view" || e.target.value === "use" || e.target.value === "manage")
                setPermission(e.target.value);
            }}
          >
            <option value="view">View · reveal secret</option>
            <option value="use">Use · run MCP requests</option>
            <option value="manage">Manage · full access</option>
          </select>
        </SummonField>
        <SummonField label="Expires at (optional)">
          <Input type="datetime-local" value={expiry} onChange={(e) => setExpiry(e.target.value)} />
        </SummonField>
        <div className="flex items-end">
          <Button type="submit" loading={pending} disabled={!memberId}>
            Grant access
          </Button>
        </div>
      </form>
      {members.status === "CanLoadMore" && (
        <Button variant="secondary" onClick={() => members.loadMore(50)}>
          Load more members
        </Button>
      )}
      <p className="text-12 text-secondary">
        The owner retains management access. View access can reveal the secret; use access cannot.
      </p>
      <ul className="divide-y divide-subtle-1">
        {grants.results.map((row) => (
          <li key={row._id} className="flex flex-wrap items-center justify-between gap-3 py-3">
            <div className="min-w-0">
              <p className="text-14 break-all">
                {members.results.find((m) => m.id === row.memberId)?.name ??
                  members.results.find((m) => m.id === row.memberId)?.email ??
                  row.memberId}
              </p>
              <p className="text-12 text-secondary">
                {row.permission} ·{" "}
                {row.expiresAt === null ? "No expiration" : `Expires ${new Date(row.expiresAt).toLocaleString()}`}
              </p>
            </div>
            <Button
              variant="secondary"
              disabled={pending}
              onClick={async () => {
                setPending(true);
                setError("");
                try {
                  await revoke({ grantId: row._id });
                } catch (failure) {
                  setError(mutationMessage(failure));
                } finally {
                  setPending(false);
                }
              }}
            >
              Revoke grant
            </Button>
          </li>
        ))}
      </ul>
      {grants.status === "LoadingFirstPage" && <p role="status">Loading access…</p>}
      {grants.status === "Exhausted" && !grants.results.length && (
        <p className="text-14 text-secondary">No additional access grants.</p>
      )}
      {grants.status === "CanLoadMore" && (
        <Button variant="secondary" onClick={() => grants.loadMore(30)}>
          Load more grants
        </Button>
      )}
      {error && (
        <p role="alert" className="text-14 text-danger-primary">
          {error}
        </p>
      )}
    </div>
  );
}
export function CredentialAudit({ credentialId }: { credentialId: Id<"mcpCredentials"> }) {
  const logs = usePaginatedQuery(api.mcp.credentials.logs, { credentialId }, { initialNumItems: 30 });
  return (
    <div className="space-y-3">
      <h3 className="text-16 font-medium">Activity log</h3>
      <ul className="divide-y divide-subtle-1">
        {logs.results.map((log) => (
          <li className="space-y-1 py-3 text-14" key={log._id}>
            <p className="font-medium">{log.action.replaceAll("_", " ")}</p>
            <p className="text-12 break-all text-secondary">
              {new Date(log._creationTime).toLocaleString()} · {log.actorId}
            </p>
            {log.memberId && <p className="text-12 break-all">Member: {log.memberId}</p>}
          </li>
        ))}
      </ul>
      {logs.status === "LoadingFirstPage" && <p role="status">Loading activity…</p>}
      {logs.status === "CanLoadMore" && (
        <Button variant="secondary" onClick={() => logs.loadMore(30)}>
          Load more activity
        </Button>
      )}
    </div>
  );
}
