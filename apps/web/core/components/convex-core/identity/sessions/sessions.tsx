import { useEffect, useState } from "react";
import { authClient } from "@/components/convex-core/provider";
import { Button } from "@plane/propel/button";
import { mutationMessage } from "../../commercial/forms";

type Session = typeof authClient.$Infer.Session.session;
export function AccountSessions() {
  const { data: current } = authClient.useSession();
  const [sessions, setSessions] = useState<Session[] | null>(null);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<Session | null>(null);
  useEffect(() => {
    const load = async () => {
      try {
        const result = await authClient.listSessions();
        if (result.error)
          setError(
            result.error.code === "SESSION_NOT_FRESH"
              ? "Sign in again to view your account sessions."
              : (result.error.message ?? "Could not load account sessions.")
          );
        else setSessions(result.data);
      } catch (failure) {
        setError(mutationMessage(failure));
      }
    };
    void load();
  }, []);
  return (
    <section className="space-y-3 border-t border-subtle-1 pt-3" aria-label="Account sessions">
      <h3 className="text-16 font-medium">Signed-in sessions</h3>
      {error && (
        <p role="alert" className="text-12 text-danger-primary">
          {error}
        </p>
      )}
      {sessions ? (
        <ul className="divide-y divide-subtle-1">
          {sessions.map((session) => (
            <li key={session.id} className="space-y-2 py-3">
              <p className="text-14 font-medium">
                {session.id === current?.session.id ? "This session" : `Session ${session.id.slice(-6)}`}
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
                End {session.id === current?.session.id ? "this session" : "session"}
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        !error && (
          <p role="status" className="text-12">
            Loading sessions…
          </p>
        )
      )}
      {sessions?.length === 0 && <p className="text-12 text-secondary">No signed-in sessions.</p>}
      {selected && (
        <RevokeSession
          key={selected.id}
          session={selected}
          isCurrent={selected.id === current?.session.id}
          onClose={() => setSelected(null)}
          onRevoked={() => setSessions((rows) => rows?.filter((row) => row.id !== selected.id) ?? null)}
        />
      )}
    </section>
  );
}
function RevokeSession({
  session,
  isCurrent,
  onClose,
  onRevoked,
}: {
  session: Session;
  isCurrent: boolean;
  onClose: () => void;
  onRevoked: () => void;
}) {
  const [pending, setPending] = useState(false),
    [error, setError] = useState("");
  return (
    <div className="space-y-3 rounded-md border border-subtle-1 p-3">
      <p className="text-14">End {isCurrent ? "this session and sign out" : `session ${session.id.slice(-6)}`}?</p>
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
              const result = isCurrent
                ? await authClient.signOut()
                : await authClient.revokeSession({ token: session.token });
              if (result.error) {
                setError(result.error.message ?? "Could not end this session.");
                return;
              }
              onRevoked();
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
