import { Component, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { useConvexAuth, useQuery } from "convex/react";
import { EAuthModes } from "@plane/constants";
import { NativeEntryAuth } from "@/components/account/native-entry/auth";
import { authClient } from "@/components/convex-core/provider";
import { api } from "@summon/convex/api";
import { Button } from "@plane/propel/button";
function SessionRecovery() {
  const [pending, setPending] = useState(false),
    [error, setError] = useState("");
  return (
    <section className="mx-auto max-w-md space-y-4 p-8">
      <h1 className="text-24 font-semibold">Sign in again</h1>
      <p className="text-14 text-secondary">Your session expired or was revoked. Sign in to continue.</p>
      <Button
        loading={pending}
        onClick={async () => {
          setPending(true);
          setError("");
          try {
            await authClient.signOut({ fetchOptions: { throw: true } });
          } catch {
            setError("Could not clear this session. Try again.");
          } finally {
            setPending(false);
          }
        }}
      >
        Continue to sign in
      </Button>
      {error && (
        <p role="alert" className="text-14 text-danger-primary">
          {error}
        </p>
      )}
    </section>
  );
}
class SessionErrors extends Component<{ children: ReactNode }, { error: unknown }> {
  state: { error: unknown } = { error: null };
  static getDerivedStateFromError(error: unknown) {
    return { error };
  }
  render() {
    const error = this.state.error;
    if (error !== null) {
      if (
        typeof error === "object" &&
        "data" in error &&
        typeof error.data === "object" &&
        error.data !== null &&
        "code" in error.data &&
        error.data.code === "SESSION_EXPIRED"
      )
        return <SessionRecovery />;
      throw error;
    }
    return this.props.children;
  }
}
function SessionGate({ children }: { children: ReactNode }) {
  const status = useQuery(api.identity.session.status, {});
  const [now, setNow] = useState(Date.now);
  const expiresAt = status?.valid ? status.expiresAt : null;
  useEffect(() => {
    if (expiresAt === null) return;
    // Browser timers cap at signed32-bit milliseconds; long-lived sessions recheck in bounded intervals.
    const timer = setTimeout(() => setNow(Date.now()), Math.max(1, Math.min(expiresAt - Date.now(), 2147483647)));
    return () => clearTimeout(timer);
  }, [expiresAt, now]);
  if (status === undefined)
    return (
      <p role="status" className="p-8">
        Checking your session…
      </p>
    );
  if (!status.valid || status.expiresAt <= now) return <SessionRecovery />;
  return children;
}
export function SessionBoundary({ children }: { children: ReactNode }) {
  const { isLoading, isAuthenticated } = useConvexAuth();
  const session = authClient.useSession();
  if (isLoading)
    return (
      <p role="status" className="p-8">
        Restoring your session…
      </p>
    );
  if (!isAuthenticated) return <NativeEntryAuth initialState={{ flow: "email", mode: EAuthModes.SIGN_IN }} />;
  return (
    <SessionErrors key={session.data?.session.id}>
      <SessionGate>{children}</SessionGate>
    </SessionErrors>
  );
}
