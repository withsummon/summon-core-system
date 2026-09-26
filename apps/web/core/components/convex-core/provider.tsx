import { Component } from "react";
import type { ReactNode } from "react";
import { ConvexReactClient } from "convex/react";
import { ConvexAuthProvider } from "@convex-dev/auth/react";

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
          <h1 className="text-xl font-semibold">This workspace is unavailable</h1>
          <p className="my-4 text-secondary">Your access may have changed. Return to your workspaces to continue.</p>
          <a className="text-accent-primary underline" href="/core">
            Return to workspaces
          </a>
        </div>
      );
    return this.props.children;
  }
}

export function CoreProvider({ children }: { children: ReactNode }) {
  if (!client)
    return (
      <div role="alert" className="p-8">
        Summon Core is unavailable. Please contact your workspace administrator.
      </div>
    );
  return (
    <CoreErrorBoundary>
      <ConvexAuthProvider client={client}>{children}</ConvexAuthProvider>
    </CoreErrorBoundary>
  );
}
