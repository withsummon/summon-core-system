import { useState } from "react";
import { useAuthActions } from "@convex-dev/auth/react";
import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "@summon/convex/api";
import { Button } from "@plane/propel/button";
import { mutationMessage } from "../../commercial/forms";
type Session = FunctionReturnType<typeof api.sessions.index.list>["page"][number];
export function AccountSessions() {
  const [cursors, setCursors] = useState<(string | null)[]>([null]);
  const result = useQuery(api.sessions.index.list, {
    paginationOpts: { cursor: cursors[cursors.length - 1], numItems: 10 },
  });
  const [selected, setSelected] = useState<Session | null>(null);
  return (
    <section className="space-y-3 border-t border-subtle-1 pt-3" aria-label="Account sessions">
      <h3 className="text-16 font-medium">Signed-in sessions</h3>
      {result ? (
        <>
          <p className="text-12 text-secondary">{result.revocationNotice}</p>
          <ul className="divide-y divide-subtle-1">
            {result.page.map((session) => (
              <li key={session.id} className="space-y-2 py-3">
                <p className="text-14 font-medium">
                  {session.isCurrent ? "This session" : `Session ${session.id.slice(-6)}`}
                </p>
                <dl className="space-y-1 text-12">
                  <div>
                    <dt className="text-secondary">Started</dt>
                    <dd>{new Date(session.createdAt).toLocaleString()}</dd>
                  </div>
                  <div>
                    <dt className="text-secondary">Expires</dt>
                    <dd>{new Date(session.expiresAt).toLocaleString()}</dd>
                  </div>
                </dl>
                <Button variant="secondary" onClick={() => setSelected(session)}>
                  End {session.isCurrent ? "this session" : "session"}
                </Button>
              </li>
            ))}
          </ul>
          {!result.page.length && <p className="text-12 text-secondary">No sessions on this page.</p>}
        </>
      ) : (
        <p role="status" className="text-12">
          Loading sessions…
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        {cursors.length > 1 && (
          <Button variant="secondary" onClick={() => setCursors(cursors.slice(0, -1))}>
            Previous sessions
          </Button>
        )}
        {result && !result.isDone && (
          <Button variant="secondary" onClick={() => setCursors([...cursors, result.continueCursor])}>
            More sessions
          </Button>
        )}
      </div>
      {selected && <RevokeSession key={selected.id} session={selected} onClose={() => setSelected(null)} />}
    </section>
  );
}
function RevokeSession({ session, onClose }: { session: Session; onClose: () => void }) {
  const revoke = useMutation(api.sessions.index.revoke);
  const { signOut } = useAuthActions();
  const [pending, setPending] = useState(false),
    [error, setError] = useState("");
  return (
    <div className="space-y-3 rounded-md border border-subtle-1 p-3">
      <p className="text-14">
        End {session.isCurrent ? "this session and sign out" : `session ${session.id.slice(-6)}`}?
      </p>
      <p className="text-12 text-secondary">
        Started {new Date(session.createdAt).toLocaleString()}. Signing in again creates a new session.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button
          loading={pending}
          onClick={async () => {
            setPending(true);
            setError("");
            try {
              const result = await revoke({ sessionId: session.id });
              if (result.revokedCurrent) await signOut();
              onClose();
            } catch (failure) {
              setError(mutationMessage(failure));
            } finally {
              setPending(false);
            }
          }}
        >
          Confirm end session
        </Button>
        <Button variant="secondary" disabled={pending} onClick={onClose}>
          Keep session
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-12 text-danger-primary">
          {error}
        </p>
      )}
    </div>
  );
}
