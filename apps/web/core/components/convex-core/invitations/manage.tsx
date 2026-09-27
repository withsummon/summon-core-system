import { useState } from "react";
import { useAction, useMutation, usePaginatedQuery, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "@summon/convex/api";
import type { Id } from "@summon/convex/data-model";
import { Button } from "@plane/propel/button";
import { Input } from "@plane/propel/input";
import { SummonField } from "@/components/summon/forms";
import { mutationMessage } from "../commercial/forms";
import { InvitationBoundary, InvitationPages, ShareToken } from "./shared";
type Scope = { workspaceId: Id<"workspaces">; projectId: Id<"projects"> | null };
type Invitation = FunctionReturnType<typeof api.invitations.index.list>["page"][number];
type Roles = FunctionReturnType<typeof api.invitations.index.access>["roles"];
export function ManagedInvitations({ scope, name }: { scope: Scope; name: string }) {
  const [open, setOpen] = useState(false);
  return (
    <section className="min-w-0 rounded-lg border border-subtle-1 p-3">
      <Button variant="secondary" aria-expanded={open} onClick={() => setOpen(!open)}>
        {open ? "Hide invitations" : `Invite to ${name}`}
      </Button>
      {open && (
        <InvitationBoundary>
          <ManagementAccess scope={scope} />
        </InvitationBoundary>
      )}
    </section>
  );
}
function ManagementAccess({ scope }: { scope: Scope }) {
  const access = useQuery(api.invitations.index.access, scope);
  if (!access) return <p role="status">Loading invitation permissions…</p>;
  if (!access.roles.length)
    return <p className="mt-3 text-14 text-secondary">Your current role cannot invite members here.</p>;
  return <Management scope={scope} roles={access.roles} />;
}
function Management({ scope, roles }: { scope: Scope; roles: Roles }) {
  const page = usePaginatedQuery(api.invitations.index.list, scope, { initialNumItems: 20 });
  const rotate = useAction(api.invitations.tokens.rotate);
  const revoke = useMutation(api.invitations.index.revoke);
  const [selection, setSelection] = useState<{ row: Invitation; operation: "rotate" | "revoke" } | null>(null);
  const [token, setToken] = useState("");
  const [pending, setPending] = useState(false),
    [error, setError] = useState("");
  async function confirm() {
    if (!selection) return;
    setPending(true);
    setError("");
    try {
      const args = { invitationId: selection.row._id, expectedRevision: selection.row.revision };
      if (selection.operation === "rotate") setToken((await rotate(args)).token);
      else await revoke(args);
      setSelection(null);
    } catch (failure) {
      setError(mutationMessage(failure));
    } finally {
      setPending(false);
    }
  }
  return (
    <div className="mt-3 min-w-0 space-y-4 text-14">
      {token ? (
        <ShareToken token={token} onDismiss={() => setToken("")} />
      ) : (
        <CreateInvitation scope={scope} roles={roles} onToken={setToken} />
      )}
      <h3 className="font-medium">Invitation history</h3>
      <ul className="space-y-3">
        {page.results.map((row) => (
          <li key={row._id} className="min-w-0 border-b border-subtle-1 pb-3">
            <p className="font-medium break-all">{row.email}</p>
            <p className="text-12 text-secondary">
              {row.role} · {row.status} · Expires {new Date(row.expiresAt).toLocaleString()}
            </p>
            {row.status === "pending" && roles.includes(row.role) && (
              <div className="mt-2 flex flex-wrap gap-2">
                <Button
                  variant="secondary"
                  disabled={pending || !!token}
                  onClick={() => {
                    setSelection({ row, operation: "rotate" });
                    setError("");
                  }}
                >
                  Replace token
                </Button>
                <Button
                  variant="secondary"
                  disabled={pending}
                  onClick={() => {
                    setSelection({ row, operation: "revoke" });
                    setError("");
                  }}
                >
                  Revoke
                </Button>
              </div>
            )}
          </li>
        ))}
      </ul>
      {!page.results.length && page.status === "Exhausted" && <p className="text-secondary">No invitations yet.</p>}
      <InvitationPages status={page.status} loadMore={page.loadMore} />
      {selection && (
        <div className="space-y-2 rounded-md border border-subtle-1 p-3">
          <p className="break-words">
            {selection.operation === "rotate" ? "Replace the token for" : "Revoke the invitation for"}{" "}
            {selection.row.email}? The previous token will stop working.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button loading={pending} onClick={() => void confirm()}>
              {selection.operation === "rotate" ? "Replace token" : "Revoke invitation"}
            </Button>
            <Button disabled={pending} variant="secondary" onClick={() => setSelection(null)}>
              Cancel
            </Button>
          </div>
        </div>
      )}
      {error && (
        <p role="alert" className="text-danger-primary">
          {error}
        </p>
      )}
    </div>
  );
}
function CreateInvitation({ scope, roles, onToken }: { scope: Scope; roles: Roles; onToken: (token: string) => void }) {
  const create = useAction(api.invitations.tokens.create);
  const [email, setEmail] = useState(""),
    [role, setRole] = useState<Roles[number]>(roles[0]);
  const [pending, setPending] = useState(false),
    [error, setError] = useState("");
  return (
    <form
      className="min-w-0 space-y-3"
      onSubmit={async (event) => {
        event.preventDefault();
        setPending(true);
        setError("");
        try {
          const result = await create({ ...scope, email, role });
          onToken(result.token);
        } catch (failure) {
          setError(mutationMessage(failure));
        } finally {
          setPending(false);
        }
      }}
    >
      <p className="text-12 text-secondary">
        Create a private token for someone with a verified email address. Share it yourself; this does not send an
        email.
      </p>
      <SummonField label="Recipient email">
        <Input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full"
          disabled={pending}
        />
      </SummonField>
      <SummonField label="Access role">
        <select
          className="max-w-full rounded-md border border-subtle-1 bg-layer-2 p-2"
          value={role}
          disabled={pending}
          onChange={(e) => {
            const next = roles.find((item) => item === e.target.value);
            if (next) setRole(next);
          }}
        >
          {roles.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </SummonField>
      {error && (
        <p role="alert" className="text-danger-primary">
          {error}
        </p>
      )}
      <Button type="submit" loading={pending}>
        Create invitation token
      </Button>
    </form>
  );
}
