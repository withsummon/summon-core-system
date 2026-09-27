import { Component, useId, useState } from "react";
import type { ReactNode } from "react";
import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "@summon/convex/api";
import { Button } from "@plane/propel/button";
import { Input } from "@plane/propel/input";
import { SummonField } from "@/components/summon/forms";
import { mutationMessage } from "../../commercial/forms";
type Admin = FunctionReturnType<typeof api.identity.instance.roster.list>["page"][number];
class AuthorityBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <div role="alert" className="space-y-2 text-14">
        <p>Instance administration is unavailable. Check your current access.</p>
        <Button variant="secondary" onClick={() => this.setState({ failed: false })}>
          Try again
        </Button>
      </div>
    ) : (
      this.props.children
    );
  }
}
export function InstanceAdministration() {
  return (
    <AuthorityBoundary>
      <AuthorityAccess />
    </AuthorityBoundary>
  );
}
function AuthorityAccess() {
  const authority = useQuery(api.identity.instance.index.me);
  const [open, setOpen] = useState(false);
  if (!authority?.isInstanceAdmin) return null;
  return (
    <section className="min-w-0 space-y-3">
      <Button type="button" variant="secondary" aria-expanded={open} onClick={() => setOpen(!open)}>
        {open ? "Hide instance administration" : "Instance administration"}
      </Button>
      {open && <Administration />}
    </section>
  );
}
function Administration() {
  const emailId = useId();
  const config = useQuery(api.identity.instance.configuration.get);
  const { results, status, loadMore } = usePaginatedQuery(
    api.identity.instance.roster.list,
    {},
    { initialNumItems: 20 }
  );
  const grant = useMutation(api.identity.instance.roster.grant);
  const revoke = useMutation(api.identity.instance.roster.revoke);
  const [email, setEmail] = useState("");
  const [selected, setSelected] = useState<Admin | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  return (
    <div className="min-w-0 space-y-4 rounded-lg border border-subtle-1 p-3">
      <h3 className="font-medium">Instance administrators</h3>
      {config && (
        <p className="text-12 text-secondary">
          Email sign-in services: {config.mailConfigured ? "Configured" : "Unavailable"}. OAuth providers:{" "}
          {config.oauthProviders.join(", ") || "None configured"}.
        </p>
      )}
      <form
        className="min-w-0 space-y-2"
        onSubmit={async (event) => {
          event.preventDefault();
          setPending(true);
          setError("");
          try {
            await grant({ email });
            setEmail("");
          } catch (failure) {
            setError(mutationMessage(failure));
          } finally {
            setPending(false);
          }
        }}
      >
        <SummonField label="Verified account email" htmlFor={emailId}>
          <Input
            id={emailId}
            type="email"
            required
            maxLength={254}
            value={email}
            disabled={pending}
            onChange={(event) => setEmail(event.target.value)}
            className="w-full min-w-0"
          />
        </SummonField>
        <Button type="submit" loading={pending}>
          Add administrator
        </Button>
      </form>
      {status === "LoadingFirstPage" && <p role="status">Loading administrators…</p>}
      <ul className="space-y-3">
        {results.map((admin) => (
          <li key={admin.id} className="min-w-0 space-y-2 border-t border-subtle-1 pt-3">
            <p className="font-medium break-words">{admin.name || "Administrator"}</p>
            <p className="text-12 break-all text-secondary">{admin.email}</p>
            <Button
              type="button"
              variant="secondary"
              disabled={pending}
              onClick={() => {
                setSelected(admin);
                setError("");
              }}
            >
              Remove administrator
            </Button>
          </li>
        ))}
      </ul>
      {status === "CanLoadMore" && (
        <Button type="button" variant="secondary" onClick={() => loadMore(20)}>
          Load more administrators
        </Button>
      )}
      {status === "LoadingMore" && <p role="status">Loading more administrators…</p>}
      {selected && (
        <div className="min-w-0 space-y-2 border-t border-subtle-1 pt-3">
          <p className="break-words">
            Remove instance access for {selected.email || selected.name}? Their workspace access remains unchanged.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              loading={pending}
              onClick={async () => {
                setPending(true);
                setError("");
                try {
                  await revoke({ membershipId: selected.id, expectedRevision: selected.revision });
                  setSelected(null);
                } catch (failure) {
                  setError(mutationMessage(failure));
                } finally {
                  setPending(false);
                }
              }}
            >
              Confirm removal
            </Button>
            <Button type="button" variant="secondary" disabled={pending} onClick={() => setSelected(null)}>
              Cancel
            </Button>
          </div>
        </div>
      )}
      {error && (
        <p role="alert" className="text-12 text-danger-primary">
          {error}
        </p>
      )}
    </div>
  );
}
