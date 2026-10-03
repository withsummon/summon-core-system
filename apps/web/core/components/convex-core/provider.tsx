import { Component } from "react";
import type { ReactNode } from "react";
import { ConvexReactClient } from "convex/react";
import { ConvexBetterAuthProvider } from "@convex-dev/better-auth/react";
import { convexClient, crossDomainClient } from "@convex-dev/better-auth/client/plugins";
import { createAuthClient, type ReactAuthClient } from "better-auth/react";
import { emailOTPClient, genericOAuthClient } from "better-auth/client/plugins";
import { ProfileAppearance } from "./identity/appearance";

export const authClient: ReactAuthClient<{
  plugins: [
    ReturnType<typeof convexClient>,
    ReturnType<typeof crossDomainClient>,
    ReturnType<typeof emailOTPClient>,
    ReturnType<typeof genericOAuthClient>,
  ];
}> = createAuthClient({
  baseURL: import.meta.env.VITE_CONVEX_SITE_URL,
  plugins: [convexClient(), crossDomainClient(), emailOTPClient(), genericOAuthClient()],
});

/** Fetch a current Convex bearer for HTTP and collaboration transports. */
export async function getAuthToken() {
  return (await authClient.convex.token({ fetchOptions: { throw: true } })).token;
}

// One client per application document preserves subscriptions across route mounts.
// Convex creates its WebSocket lazily when the first consumer subscribes.
const url = import.meta.env.VITE_CONVEX_URL;
const client = url ? new ConvexReactClient(url) : null;
if (import.meta.hot)
  import.meta.hot.dispose(() => {
    void client?.close();
  });

class CoreErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (this.state.failed)
      return (
        <div className="p-8">
          <h1 className="text-xl font-semibold">Summon Core could not load</h1>
          <p className="my-4 text-secondary">Reload this page to retry, or return to your workspaces.</p>
          <a className="text-accent-primary underline" href="/core">
            Return to workspaces
          </a>
        </div>
      );
    return this.props.children;
  }
}

export function CoreProvider({ children }: { children: ReactNode }) {
  if (!client || !import.meta.env.VITE_CONVEX_SITE_URL)
    return (
      <div role="alert" className="p-8">
        Summon Core is unavailable. Please contact your workspace administrator.
      </div>
    );
  return (
    <CoreErrorBoundary>
      <ConvexBetterAuthProvider client={client} authClient={authClient}>
        <ProfileAppearance />
        {children}
      </ConvexBetterAuthProvider>
    </CoreErrorBoundary>
  );
}
