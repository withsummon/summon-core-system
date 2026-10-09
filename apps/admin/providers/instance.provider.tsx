import { Component, useEffect, useState, type ReactNode } from "react";
import { ConvexReactClient } from "convex/react";
import { ConvexBetterAuthProvider } from "@convex-dev/better-auth/react";
import { convexClient, crossDomainClient } from "@convex-dev/better-auth/client/plugins";
import { createAuthClient, type ReactAuthClient } from "better-auth/react";

export const authClient: ReactAuthClient<{
  plugins: [ReturnType<typeof convexClient>, ReturnType<typeof crossDomainClient>];
}> = createAuthClient({
  baseURL: import.meta.env.VITE_CONVEX_SITE_URL,
  plugins: [convexClient(), crossDomainClient()],
});
const backendUrl = import.meta.env.VITE_CONVEX_URL;
const client = backendUrl ? new ConvexReactClient(backendUrl) : null;
if (import.meta.hot)
  import.meta.hot.dispose(() => {
    void client?.close();
  });

class AdministrationErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (this.state.error)
      return (
        <div role="alert" className="p-8">
          <h1 className="text-18 font-medium">Administration could not load</h1>
          <p className="my-4 text-secondary">{this.state.error.message}</p>
          <a className="text-accent-primary underline" href="/">
            Return to sign in
          </a>
        </div>
      );
    return this.props.children;
  }
}
export function InstanceProvider({ children }: { children: ReactNode }) {
  if (!client || !import.meta.env.VITE_CONVEX_SITE_URL)
    return (
      <div role="alert" className="p-8">
        Administration is unavailable. Contact the instance operator.
      </div>
    );
  return (
    <AdministrationErrorBoundary>
      <ConvexBetterAuthProvider client={client} authClient={authClient}>
        {children}
      </ConvexBetterAuthProvider>
    </AdministrationErrorBoundary>
  );
}

// Both the current account avatar and the administrator directory logo use
// native published descriptors; authorization is rechecked by the byte owner.
export function useAdminAssetUrl(downloadPath: string | null | undefined) {
  const [url, setUrl] = useState<string | undefined>();
  useEffect(() => {
    setUrl(undefined);
    if (!downloadPath) return;
    const abort = new AbortController();
    let resource: string | undefined;
    void (async () => {
      const { token } = await authClient.convex.token({ fetchOptions: { throw: true } });
      const response = await fetch(new URL(downloadPath, import.meta.env.VITE_CONVEX_SITE_URL), {
        headers: { Authorization: `Bearer ${token}` },
        signal: abort.signal,
      });
      if (!response.ok) throw new Error("The published image is unavailable.");
      resource = URL.createObjectURL(await response.blob());
      if (abort.signal.aborted) URL.revokeObjectURL(resource);
      else setUrl(resource);
    })().catch(() => {
      if (!abort.signal.aborted) setUrl(undefined);
    });
    return () => {
      abort.abort();
      if (resource) URL.revokeObjectURL(resource);
    };
  }, [downloadPath]);
  return url;
}
