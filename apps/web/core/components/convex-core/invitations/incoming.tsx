import { useState } from "react";
import { useAction, usePaginatedQuery, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "@summon/convex/api";
import { Button } from "@plane/propel/button";
import { Input } from "@plane/propel/input";
import { SummonField } from "@/components/summon/forms";
import { mutationMessage } from "../commercial/forms";
import { InvitationBoundary, InvitationPages } from "./shared";
type Invitation = FunctionReturnType<typeof api.invitations.index.incoming>["page"][number];
export function IncomingInvitations() {
  const [open, setOpen] = useState(false);
  return (
    <section className="min-w-0 space-y-3">
      <Button variant="secondary" aria-expanded={open} onClick={() => setOpen(!open)}>
        {open ? "Hide invitations" : "Invitations"}
      </Button>
      {open && (
        <InvitationBoundary>
          <RecipientAccess />
        </InvitationBoundary>
      )}
    </section>
  );
}
function RecipientAccess() {
  const access = useQuery(api.invitations.index.recipientAccess);
  if (!access) return <p role="status">Loading invitation access…</p>;
  if (!access.canRespond)
    return (
      <p className="text-12 text-secondary">
        Verify your account email before viewing or responding to invitations. Use the verification option in sign-in,
        then reopen Invitations.
      </p>
    );
  return <IncomingList />;
}
function IncomingList() {
  const page = usePaginatedQuery(api.invitations.index.incoming, {}, { initialNumItems: 20 });
  const [selected, setSelected] = useState<Invitation | null>(null),
    [message, setMessage] = useState("");
  return (
    <div className="min-w-0 space-y-3 rounded-lg border border-subtle-1 p-3">
      <h3 className="font-medium">Your invitations</h3>
      <p className="text-12 text-secondary">
        Ask the inviter for the private token. Existing active membership roles stay unchanged when accepting.
      </p>
      <ul className="space-y-3">
        {page.results.map((row) => (
          <li key={row._id} className="min-w-0 space-y-1 border-b border-subtle-1 pb-3">
            <p className="font-medium break-words">
              {row.workspaceName ?? "Unavailable workspace"}
              {row.projectId && ` / ${row.projectName ?? "Unavailable project"}`}
            </p>
            <p className="text-12 text-secondary">
              {row.role} access · Expires {new Date(row.expiresAt).toLocaleString()}
            </p>
            <Button
              variant="secondary"
              onClick={() => {
                setSelected(row);
                setMessage("");
              }}
            >
              Respond
            </Button>
          </li>
        ))}
      </ul>
      {selected && (
        <ResponseForm
          key={selected._id}
          invitation={selected}
          onClose={() => setSelected(null)}
          onComplete={(accepted) => {
            setSelected(null);
            setMessage(
              accepted
                ? "Invitation accepted. Choose the workspace from the workspace selector."
                : "Invitation declined."
            );
          }}
        />
      )}
      {message && <p role="status">{message}</p>}
      {!page.results.length && page.status === "Exhausted" && <p className="text-secondary">No pending invitations.</p>}
      <InvitationPages status={page.status} loadMore={page.loadMore} />
    </div>
  );
}
function ResponseForm({
  invitation,
  onClose,
  onComplete,
}: {
  invitation: Invitation;
  onClose: () => void;
  onComplete: (accepted: boolean) => void;
}) {
  const respond = useAction(api.invitations.tokens.respond);
  const [token, setToken] = useState(""),
    [pending, setPending] = useState(false),
    [error, setError] = useState("");
  async function submit(accepted: boolean) {
    setPending(true);
    setError("");
    try {
      await respond({ invitationId: invitation._id, token: token.trim(), accepted });
      onComplete(accepted);
    } catch (failure) {
      setError(mutationMessage(failure));
    } finally {
      setPending(false);
    }
  }
  return (
    <form
      className="min-w-0 space-y-3 rounded-md border border-subtle-1 p-3"
      onSubmit={(event) => {
        event.preventDefault();
        void submit(true);
      }}
    >
      <p className="break-words">
        Respond to {invitation.projectName ?? invitation.workspaceName} — {invitation.role} access.
      </p>
      <SummonField label="Invitation token">
        <Input
          type="password"
          autoComplete="off"
          required
          value={token}
          onChange={(e) => setToken(e.target.value)}
          disabled={pending}
          className="w-full"
        />
      </SummonField>
      {error && (
        <p role="alert" className="text-danger-primary">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" loading={pending}>
          Accept invitation
        </Button>
        <Button
          type="button"
          variant="secondary"
          disabled={pending || !token.trim()}
          onClick={() => void submit(false)}
        >
          Decline
        </Button>
        <Button type="button" variant="secondary" disabled={pending} onClick={onClose}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
