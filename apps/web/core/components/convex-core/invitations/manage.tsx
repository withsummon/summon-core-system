import { useState } from "react";
import { useAction, useMutation, usePaginatedQuery, useQuery } from "convex/react";
import type { FunctionArgs, FunctionReturnType } from "convex/server";
import { api } from "@summon/convex/api";
import { Button } from "@plane/propel/button";
import { copyTextToClipboard } from "@plane/utils";
import { SendWorkspaceInvitationModal } from "@/components/workspace/members";
import { mutationMessage } from "../commercial/forms";
import { InvitationBoundary, InvitationPages } from "./shared";

type Scope = Pick<FunctionArgs<typeof api.invitations.index.create>, "workspaceId" | "projectId">;
type Invitation = FunctionReturnType<typeof api.invitations.index.list>["page"][number];
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
function Management({
  scope,
  roles,
}: {
  scope: Scope;
  roles: FunctionReturnType<typeof api.invitations.index.access>["roles"];
}) {
  const page = usePaginatedQuery(api.invitations.index.list, scope, { initialNumItems: 20 });
  const policy = useQuery(api.invitations.index.availability);
  const resend = useAction(api.invitations.email.resend);
  const revoke = useMutation(api.invitations.index.revoke);
  const [inviting, setInviting] = useState(false);
  const [selection, setSelection] = useState<Invitation | null>(null);
  const [pending, setPending] = useState(false),
    [error, setError] = useState("");
  return (
    <div className="mt-3 min-w-0 space-y-4 text-14">
      <Button onClick={() => setInviting(true)}>Create invitations</Button>
      {inviting && <SendWorkspaceInvitationModal scope={scope} onClose={() => setInviting(false)} />}
      <h3 className="font-medium">Invitation history</h3>
      <ul className="space-y-3">
        {page.results.map((row) => (
          <li key={row._id} className="min-w-0 border-b border-subtle-1 pb-3">
            <p className="font-medium break-all">{row.email}</p>
            <p className="text-12 text-secondary">
              {row.role} · {row.status} · Expires {new Date(row.expiresAt).toLocaleString()}
            </p>
            {row.delivery === "failed" && <p role="status">Email delivery failed. You can resend or copy the link.</p>}
            {row.status === "pending" && roles.includes(row.role) && (
              <div className="mt-2 flex flex-wrap gap-2">
                <Button
                  variant="secondary"
                  onClick={async () => {
                    try {
                      const link = new URL("/workspace-invitations/", window.location.origin);
                      link.searchParams.set("invitation_id", row._id);
                      await copyTextToClipboard(link.href);
                      setError("");
                    } catch (failure) {
                      setError(mutationMessage(failure));
                    }
                  }}
                >
                  Copy link
                </Button>
                {policy?.emailDelivery && (
                  <Button
                    variant="secondary"
                    disabled={pending}
                    onClick={async () => {
                      setPending(true);
                      setError("");
                      try {
                        const result = await resend({ invitationId: row._id, expectedRevision: row.revision });
                        if (result.delivery !== "sent")
                          setError(
                            result.delivery === "failed"
                              ? "Email delivery failed. Try again or copy the link."
                              : "This invitation changed. Review it again."
                          );
                      } catch (failure) {
                        setError(mutationMessage(failure));
                      } finally {
                        setPending(false);
                      }
                    }}
                  >
                    Resend invitation
                  </Button>
                )}
                <Button
                  variant="secondary"
                  disabled={pending}
                  onClick={() => {
                    setSelection(row);
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
          <p className="break-words">Revoke the invitation for {selection.email}? Its link will stop working.</p>
          <div className="flex flex-wrap gap-2">
            <Button
              loading={pending}
              onClick={async () => {
                setPending(true);
                setError("");
                try {
                  await revoke({ invitationId: selection._id, expectedRevision: selection.revision });
                  setSelection(null);
                } catch (failure) {
                  setError(mutationMessage(failure));
                } finally {
                  setPending(false);
                }
              }}
            >
              Revoke invitation
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
